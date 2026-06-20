#!/usr/bin/env sh

set -eu

TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"
PROXY_NAME="${PROXY_NAME:-primary_api}"

curl -sS -X POST "${TOXIPROXY_URL}/proxies" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${PROXY_NAME}\",\"listen\":\"0.0.0.0:8666\",\"upstream\":\"primary-api:8081\"}" >/dev/null || true

curl -sS -X DELETE "${TOXIPROXY_URL}/proxies/${PROXY_NAME}/toxics/packet_loss_20" >/dev/null || true

curl -sS -X POST "${TOXIPROXY_URL}/proxies/${PROXY_NAME}/toxics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "packet_loss_20",
    "type": "timeout",
    "stream": "upstream",
    "toxicity": 0.2,
    "attributes": {
      "timeout": 0
    }
  }'

echo "Injected a 20% failure toxic on the primary API path to simulate packet loss."
