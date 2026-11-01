#!/usr/bin/env bash
# Deploy an image tag to the Portainer stack and wait until it is live and healthy.
#
#   deploy/portainer-deploy.sh <image-tag>
#
# Env: PORTAINER_URL, PORTAINER_API_KEY, PORTAINER_STACK_ID, PORTAINER_ENDPOINT_ID
#      APP_HEALTH_URL (default https://gymbros.gabrieldiem.com/api/health)
#
# Keeps every environment variable already set in Portainer and only replaces IMAGE_TAG, sends
# deploy/compose.edge.yaml as the stack file, and asks Portainer to pull the images and recreate the
# containers. Exits non-zero (the CI job turns red) if a required variable is missing, Portainer
# can't deploy, the containers don't come up healthy on the new tag, or the public health check
# fails.
#
# How a failure leaves the running version (Portainer validates, then pulls, then replaces):
# - A missing variable stops the deploy before anything is sent.
# - If Portainer fails before replacing containers, they keep running and are left alone. Restoring
#   would hurt: Portainer runs `compose down` first when it updates a stack in the error state
#   (volumes are kept). Portainer shows the stack as failed until the next deploy.
# - If containers were replaced, it restores the previous stack file and IMAGE_TAG, then checks they
#   came back healthy. The new file can't be used for that: whatever failed it could fail the
#   restore too, and that leaves the site down.
#
# Tests: deploy/test_portainer_deploy.py
set -euo pipefail

TAG=${1:?usage: portainer-deploy.sh <image-tag>}
: "${PORTAINER_URL:?}" "${PORTAINER_API_KEY:?}" "${PORTAINER_STACK_ID:?}" "${PORTAINER_ENDPOINT_ID:?}"
HEALTH_URL=${APP_HEALTH_URL:-https://gymbros.gabrieldiem.com/api/health}
COMPOSE_FILE=${COMPOSE_FILE:-"$(dirname "$0")/compose.edge.yaml"}
PROJECT=gymbros
SERVICES=(postgres api web)
STACK_URL="${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}"
POLL_SECONDS=${POLL_SECONDS:-5}

api() { curl -sS --fail-with-body --max-time 600 -H "X-API-Key: ${PORTAINER_API_KEY}" "$@"; }

# Send stack file $3 with IMAGE_TAG=$1 (other env vars untouched); $2 = pull images (true/false).
update_stack() {
  local env payload
  env=$(jq --arg tag "$1" '[.Env[]? | select(.name != "IMAGE_TAG")] + [{name: "IMAGE_TAG", value: $tag}]' <<<"$STACK")
  payload=$(jq -n --rawfile file "$3" --argjson env "$env" --argjson pull "$2" \
    '{stackFileContent: $file, env: $env, prune: true, pullImage: $pull}')
  api -X PUT -H "Content-Type: application/json" --data "$payload" \
    "${STACK_URL}?endpointId=${PORTAINER_ENDPOINT_ID}"
}

# Portainer applies updates asynchronously: wait for the stack's deployment status
# (3 = deploying, 4 = failed with a message). Prints the failure message and returns 1 on failure.
wait_for_portainer() {
  local attempt last status
  for attempt in $(seq 1 60); do
    last=$(api "$STACK_URL" | jq -c '.DeploymentStatus[-1] // {}')
    status=$(jq -r '.Status // empty' <<<"$last")
    if [ "$status" = 4 ]; then jq -r '.Message // "no message"' <<<"$last"; return 1; fi
    if [ -n "$status" ] && [ "$status" != 3 ]; then return 0; fi
    sleep "$POLL_SECONDS"
  done
  echo "still deploying after 5 minutes"
  return 1
}

# Every variable the stack file requires (${NAME:?...}) that Portainer has no value for.
missing_variables() {
  local name
  for name in $(grep -oP '\$\{\K[A-Za-z_][A-Za-z0-9_]*(?=:?\?)' "$COMPOSE_FILE" | sort -u); do
    [ "$name" = IMAGE_TAG ] && continue
    jq -e --arg name "$name" 'any(.Env[]?; .name == $name and (.value // "") != "")' \
      <<<"$STACK" >/dev/null || echo "$name"
  done
}

read_containers() {
  api "${PORTAINER_URL}/api/endpoints/${PORTAINER_ENDPOINT_ID}/docker/containers/json?all=1" |
    jq -r --arg p "$PROJECT" '.[] | select(.Labels["com.docker.compose.project"] == $p)
      | "\(.Labels["com.docker.compose.service"])\t\(.Status)\t\(.Image)"'
}

# Whether report $2 shows postgres, api and web healthy, with api and web on tag $1.
containers_ready() {
  local line svc
  for svc in "${SERVICES[@]}"; do
    line=$(grep -P "^${svc}\t" <<<"$2" || true)
    [[ "$line" == *"(healthy)"* ]] || return 1
    if [ "$svc" != postgres ] && [[ "$line" != *":$1" ]]; then return 1; fi
  done
}

# Wait until the containers are ready on tag $1. Prints what it saw.
wait_for_containers() {
  local attempt report
  for attempt in $(seq 1 40); do
    report=$(read_containers)
    if containers_ready "$1" "$report"; then
      printf '   %s\n' "${report//$'\n'/$'\n   '}"
      return 0
    fi
    [ "$attempt" -lt 40 ] && sleep "$POLL_SECONDS"
  done
  printf '   %s\n' "${report//$'\n'/$'\n   '}"
  return 1
}

# Whether the failed deploy never replaced anything: the previous version still serves the site.
previous_still_running() {
  [ -n "$PREV_TAG" ] &&
    containers_ready "$PREV_TAG" "$(read_containers)" &&
    curl -fs --max-time 10 "$HEALTH_URL" | grep -q '"database":"up"'
}

# Wait until the public health check says the database is up. Prints its body; retries go to stderr.
wait_for_public_health() {
  local attempt body
  for attempt in $(seq 1 20); do
    body=$(curl -fs --max-time 10 "$HEALTH_URL" || true)
    if grep -q '"database":"up"' <<<"$body"; then
      echo "$body"
      return 0
    fi
    echo "   attempt ${attempt}: ${body:-no response}" >&2
    [ "$attempt" -lt 20 ] && sleep "$((POLL_SECONDS < 3 ? POLL_SECONDS : 3))"
  done
  return 1
}

restore_previous() {
  local out
  if [ -z "$PREV_TAG" ] || [ "$PREV_TAG" = "$TAG" ]; then
    echo "::error::Nothing older to restore. Check the site: ${HEALTH_URL}"
    return
  fi
  echo "⏪ Restoring ${PREV_TAG} with its previous stack file"
  if ! out=$(update_stack "$PREV_TAG" false "$PREV_FILE" 2>&1); then
    echo "::error::The restore was rejected, the site may be down: ${out}"
  elif ! out=$(wait_for_portainer); then
    echo "::error::The restore failed, the site may be down: ${out}"
  elif ! wait_for_containers "$PREV_TAG" || ! wait_for_public_health >/dev/null; then
    echo "::error::${PREV_TAG} was restored but isn't healthy, the site may be down"
  else
    echo "   restored: ${PREV_TAG} is live and healthy, and this deploy did not go out"
    return
  fi
  echo "   Check Portainer (Stacks → ${PROJECT}), fix the cause, then run Redeploy with ${PREV_TAG}"
}

fail() {
  echo "❌ $1"
  if previous_still_running; then
    echo "✅ Nothing was replaced: ${PREV_TAG} is still running and healthy, so it was left alone."
    echo "::warning::Portainer shows the stack as failed until the next deploy, and that deploy stops the containers first (a short outage). Don't press Update the stack until the cause is fixed: it would retry the failed version."
    exit 1
  fi
  restore_previous
  exit 1
}

echo "📦 Reading the current stack"
STACK=$(api "$STACK_URL")
PREV_TAG=$(jq -r '[.Env[]? | select(.name == "IMAGE_TAG") | .value][0] // empty' <<<"$STACK")
PREV_FILE=$(mktemp)
trap 'rm -f "$PREV_FILE"' EXIT
api "${STACK_URL}/file" | jq -j '.StackFileContent' >"$PREV_FILE"
echo "   currently deployed: ${PREV_TAG:-none}"
if [ "$(jq -r '.DeploymentStatus[-1].Status // empty' <<<"$STACK")" = 4 ]; then
  echo "::warning::Portainer has this stack as failed, so it will stop the containers before deploying (a short outage)."
fi

missing=$(missing_variables)
if [ -n "$missing" ]; then
  echo "::error::Set these in Portainer (Stacks → ${PROJECT} → Environment variables), then re-run: ${missing//$'\n'/, }"
  echo "❌ Nothing was changed: ${PREV_TAG:-the current version} is still running"
  exit 1
fi

echo "🚀 Deploying ${TAG} (pull + recreate)"
out=$(update_stack "$TAG" true "$COMPOSE_FILE") || fail "Portainer rejected the update: ${out}"

echo "⏳ Waiting for Portainer to apply the stack"
msg=$(wait_for_portainer) || fail "Portainer could not deploy the stack: ${msg}"

echo "⏳ Waiting for ${SERVICES[*]} to be healthy on ${TAG}"
wait_for_containers "$TAG" || fail "The containers did not become healthy on ${TAG}"

echo "🩺 Checking ${HEALTH_URL}"
body=$(wait_for_public_health) || fail "${HEALTH_URL} is not healthy after the deploy"
echo "✅ ${TAG} is live and healthy: ${body}"
