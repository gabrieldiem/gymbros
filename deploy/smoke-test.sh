#!/usr/bin/env bash
# Start the production stack file with the given images on an empty database and check it works,
# without touching production. Run by CI before every deploy.
#
#   deploy/smoke-test.sh <image-tag>
#
# Catches images that don't start, migrations that fail on a clean database, and stack file mistakes.
# It also rehearses a rollback: the api must still start when the database is ahead of it.
set -euo pipefail

export IMAGE_TAG=${1:?usage: smoke-test.sh <image-tag>}
export POSTGRES_PASSWORD=smoke-password
export SESSION_SECRET=smoke-session-secret-at-least-32-characters
export GOOGLE_CLIENT_ID=smoke-client-id
export GOOGLE_CLIENT_SECRET=smoke-client-secret

DIR=$(cd "$(dirname "$0")" && pwd)
BASE=http://127.0.0.1:8090
compose=(docker compose -p gymbros-smoke -f "$DIR/compose.edge.yaml" -f "$DIR/compose.smoke.yaml")

finish() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo "❌ Smoke test failed. The running version was not touched."
    "${compose[@]}" ps -a || true
    "${compose[@]}" logs --tail 40 api web || true
  fi
  "${compose[@]}" down --remove-orphans >/dev/null 2>&1 || true
  exit "$code"
}
trap finish EXIT

# check <description> <text expected in the output> <curl args...>
check() {
  local description=$1 expected=$2 output
  shift 2
  output=$(curl -s --max-time 10 "$@")
  if ! grep -q -- "$expected" <<<"$output"; then
    echo "   ${description}: expected '${expected}', got: ${output:0:300}"
    return 1
  fi
  echo "   ${description}: ok"
}

echo "🚀 Starting the stack on ${IMAGE_TAG}"
"${compose[@]}" up -d --wait --wait-timeout 180

echo "🩺 Checking it through the web container"
check "health, database and migrations" '"database":"up"' "$BASE/api/health"
check "home page" 'id="root"' "$BASE/"
check "privacy policy without JavaScript" 'Google user data' "$BASE/privacy"
check "terms without JavaScript" 'Train safely' "$BASE/terms"
check "Google sign-in offered, dev login off" '"google":true,"dev_login":false' "$BASE/api/auth/options"
check "Google sign-in redirects" 'location: https://accounts.google.com' -D - -o /dev/null "$BASE/api/auth/google/start"
check "dev login is blocked" '^404' -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -d '{"email":"smoke@example.com"}' "$BASE/api/auth/dev-login"

echo "⏪ Rehearsing a rollback: the database is ahead of this image"
"${compose[@]}" exec -T postgres psql -U gymbros -d gymbros -qc \
  "UPDATE alembic_version SET version_num = 'from_a_newer_version'"
"${compose[@]}" up -d --force-recreate --wait --wait-timeout 120 api
check "still starts and serves" '"database":"up"' "$BASE/api/health"

echo "✅ ${IMAGE_TAG} passed"
