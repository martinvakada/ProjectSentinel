#!/usr/bin/env sh

set -eu

TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"
PROXY_NAME="${PROXY_NAME:-primary_api}"

curl -sS -X POST "${TOXIPROXY_URL}/proxies" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${PROXY_NAME}\",\"listen\":\"0.0.0.0:8666\",\"upstream\":\"primary-api:8081\"}" >/dev/null || true

curl -sS -X DELETE "${TOXIPROXY_URL}/proxies/${PROXY_NAME}/toxics/latency_500ms" >/dev/null || true

curl -sS -X POST "${TOXIPROXY_URL}/proxies/${PROXY_NAME}/toxics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "latency_500ms",
    "type": "latency",
    "stream": "upstream",
    "toxicity": 1.0,
    "attributes": {
      "latency": 500,
      "jitter": 0
    }
  }'

echo "Injected 500ms latency on the primary API path."
