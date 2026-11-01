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
# containers. Exits non-zero (the CI job turns red) if Portainer can't deploy, the containers don't
# come up healthy on the new tag, or the public health check fails. On failure it puts the previous
# IMAGE_TAG back and redeploys it, so Portainer and the running containers stay consistent.
set -euo pipefail

TAG=${1:?usage: portainer-deploy.sh <image-tag>}
: "${PORTAINER_URL:?}" "${PORTAINER_API_KEY:?}" "${PORTAINER_STACK_ID:?}" "${PORTAINER_ENDPOINT_ID:?}"
HEALTH_URL=${APP_HEALTH_URL:-https://gymbros.gabrieldiem.com/api/health}
COMPOSE_FILE=${COMPOSE_FILE:-"$(dirname "$0")/compose.edge.yaml"}
PROJECT=gymbros
SERVICES=(postgres api web)
STACK_URL="${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}"

api() { curl -sS --fail-with-body --max-time 600 -H "X-API-Key: ${PORTAINER_API_KEY}" "$@"; }

# Send the stack file with IMAGE_TAG=$1 (other env vars untouched); $2 = pull images (true/false).
update_stack() {
  local env payload
  env=$(jq --arg tag "$1" '[.Env[]? | select(.name != "IMAGE_TAG")] + [{name: "IMAGE_TAG", value: $tag}]' <<<"$STACK")
  payload=$(jq -n --rawfile file "$COMPOSE_FILE" --argjson env "$env" --argjson pull "$2" \
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
    sleep 5
  done
  echo "still deploying after 5 minutes"
  return 1
}

fail() {
  echo "❌ $1"
  if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$TAG" ]; then
    echo "⏪ Restoring the previous image tag ${PREV_TAG}"
    if update_stack "$PREV_TAG" false >/dev/null && wait_for_portainer >/dev/null; then
      echo "   restored: ${PREV_TAG} is deployed again"
    else
      echo "   restore failed: fix it in Portainer (Stacks → ${PROJECT}) or run Redeploy with ${PREV_TAG}"
    fi
  fi
  exit 1
}

echo "📦 Reading the current stack"
STACK=$(api "$STACK_URL")
PREV_TAG=$(jq -r '[.Env[]? | select(.name == "IMAGE_TAG") | .value][0] // empty' <<<"$STACK")
echo "   currently deployed: ${PREV_TAG:-none}"

echo "🚀 Deploying ${TAG} (pull + recreate)"
out=$(update_stack "$TAG" true) || fail "Portainer rejected the update: ${out}"

echo "⏳ Waiting for Portainer to apply the stack"
msg=$(wait_for_portainer) || fail "Portainer could not deploy the stack: ${msg}"

echo "⏳ Waiting for ${SERVICES[*]} to be healthy on ${TAG}"
for attempt in $(seq 1 40); do
  report=$(api "${PORTAINER_URL}/api/endpoints/${PORTAINER_ENDPOINT_ID}/docker/containers/json?all=1" |
    jq -r --arg p "$PROJECT" '.[] | select(.Labels["com.docker.compose.project"] == $p)
      | "\(.Labels["com.docker.compose.service"])\t\(.Status)\t\(.Image)"')
  ready=true
  for svc in "${SERVICES[@]}"; do
    line=$(grep -P "^${svc}\t" <<<"$report" || true)
    [[ "$line" == *"(healthy)"* ]] || ready=false
    if [ "$svc" != postgres ] && [[ "$line" != *":${TAG}" ]]; then ready=false; fi
  done
  if $ready; then
    printf '   %s\n' "${report//$'\n'/$'\n   '}"
    break
  fi
  if [ "$attempt" -eq 40 ]; then
    printf '   %s\n' "${report//$'\n'/$'\n   '}"
    fail "The containers did not become healthy on ${TAG}"
  fi
  sleep 5
done

echo "🩺 Checking ${HEALTH_URL}"
for attempt in $(seq 1 20); do
  body=$(curl -fs --max-time 10 "$HEALTH_URL" || true)
  if grep -q '"database":"up"' <<<"$body"; then
    echo "✅ ${TAG} is live and healthy: ${body}"
    exit 0
  fi
  echo "   attempt ${attempt}: ${body:-no response}"
  sleep 3
done
fail "${HEALTH_URL} is not healthy after the deploy"
