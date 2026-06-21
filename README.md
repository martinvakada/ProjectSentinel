# Project Sentinel

Project Sentinel is a high-performance Go API multiplexer that routes traffic to a primary API, trips a custom circuit breaker when the primary becomes unhealthy, falls back to a secondary API, and streams live telemetry to a React dashboard over WebSockets.

## Architecture Diagram

```text
Client
  |
  v
Frontend Dashboard (React + Vite)
  |
  | WebSocket (/ws)
  v
Go Backend API Multiplexer (/api/data, /metrics, /health)
  |
  +--> Toxiproxy --> Primary API (/data)
  |
  +--> Secondary API (/data)
```

## Project Structure

```text
backend/
  cmd/main.go
  internal/
    circuitbreaker/
    config/
    handlers/
    metrics/
    proxy/
    websocket/
frontend/
  src/
primary-api/
secondary-api/
scripts/
docker-compose.yml
README.md
```

## Backend Overview

- `backend/cmd/main.go`: boots the HTTP server, wires the breaker, metrics collector, websocket hub, handlers, and Toxiproxy bootstrap.
- `backend/internal/circuitbreaker/state.go`: declares `CLOSED`, `OPEN`, and `HALF_OPEN`.
- `backend/internal/circuitbreaker/breaker.go`: implements the custom circuit breaker with mutex protection and a single half-open probe.
- `backend/internal/proxy/proxy.go`: routes `/api/data` through `httputil.ReverseProxy`, applies a `context.WithTimeout` of `200ms`, detects primary failure, and falls back to the secondary API.
- `backend/internal/metrics/metrics.go`: tracks RPS, totals, routing distribution, failed requests, latency, and active websocket connections.
- `backend/internal/websocket/hub.go`: broadcasts metrics every second.
- `backend/internal/websocket/client.go`: handles websocket lifecycle, ping/pong, and connection cleanup.
- `backend/internal/handlers/api.go`: exposes `/api/data` and `/metrics`.
- `backend/internal/handlers/health.go`: exposes `/health`.
- `backend/internal/handlers/websocket.go`: exposes `/ws`.
- `backend/internal/config/config.go`: reads all runtime configuration from environment variables.

## Circuit Breaker Behavior

- `CLOSED`: requests go to the primary API and failures are counted.
- `OPEN`: requests skip the primary API and are routed directly to the secondary API.
- `HALF_OPEN`: a single probe request is allowed back to the primary API after the open duration elapses.
- Success in `HALF_OPEN` returns the breaker to `CLOSED`.
- Failure in `HALF_OPEN` returns the breaker to `OPEN`.

Default configuration:

- Failure threshold: `5`
- Request timeout: `200ms`
- Open duration: `10s`

## WebSocket Telemetry

The backend broadcasts a metrics snapshot every second on `/ws`.

Example payload:

```json
{
  "rps": 12,
  "state": "CLOSED",
  "currentRoute": "primary",
  "totalRequests": 48,
  "primaryRequests": 45,
  "secondaryRequests": 3,
  "failedRequests": 0,
  "latency": 22.5,
  "activeConnections": 1
}
```

The React dashboard consumes this stream directly. There is no polling.

## Local Run Instructions

### 1. Start the primary API

```bash
cd primary-api
go run .
```

### 2. Start the secondary API

```bash
cd secondary-api
go run .
```

### 3. Start the backend

```bash
cd backend
set PRIMARY_API_URL=http://localhost:8081
set SECONDARY_API_URL=http://localhost:8082
go run ./cmd
```

On macOS or Linux:

```bash
cd backend
PRIMARY_API_URL=http://localhost:8081 SECONDARY_API_URL=http://localhost:8082 go run ./cmd
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Docker Instructions

Bring the full stack up with:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Primary API: `http://localhost:8081/data`
- Secondary API: `http://localhost:8082/data`
- Toxiproxy admin: `http://localhost:8474`
- Toxiproxy proxy: `http://localhost:8666`

The backend bootstraps the `primary_api` proxy in Toxiproxy during startup.

## Chaos Testing Instructions

### Inject 500ms latency

```bash
sh scripts/inject-latency.sh
```

Expected result:

- Primary requests exceed the `200ms` backend timeout.
- The circuit breaker reaches the failure threshold.
- The circuit opens.
- Traffic shifts to the secondary API.
- The dashboard updates to show `OPEN` and `Secondary API`.

### Inject 20% packet loss simulation

```bash
sh scripts/inject-packet-loss.sh
```

Expected result:

- Roughly 20% of primary-path requests are interrupted.
- The breaker accumulates failures and opens when the threshold is reached.
- Fallback traffic is sent to the secondary API.
- WebSocket telemetry shows route and state changes in real time.

## How Components Connect

1. The frontend opens a websocket connection to `ws://localhost:8080/ws`.
2. The backend hub sends a JSON metrics snapshot every second.
3. The dashboard updates the state cards and charts from those snapshots.
4. Client requests to `/api/data` first attempt the primary path.
5. If the primary fails, the breaker records the failure and the backend immediately retries against the secondary API.

## Fallback Testing Guide

To exercise fallback locally without Docker:

1. Start the primary API and backend.
2. Stop the primary API.
3. Send repeated requests to `http://localhost:8080/api/data`.
4. After `5` failed primary attempts, the breaker opens.
5. Responses continue from the secondary API while the primary is bypassed.
6. Wait `10` seconds for the breaker to enter `HALF_OPEN`.
7. Restart the primary API and send another request to close the breaker again.

Example request:

```bash
curl http://localhost:8080/api/data
```

## Frontend Overview

- `frontend/src/hooks/useWebSocket.js`: owns websocket connection, reconnection, and rolling chart history.
- `frontend/src/components/Dashboard.jsx`: composes the dashboard layout with memoized cards and chart data.
- `frontend/src/components/CircuitBreakerCard.jsx`: displays breaker state with color-coded status.
- `frontend/src/components/RouteCard.jsx`: displays the active route and route distribution.
- `frontend/src/components/MetricsCard.jsx`: displays individual key metrics.
- `frontend/src/components/RPSChart.jsx`: renders the RPS chart, latency chart, request distribution chart, and request history chart using Recharts.

## High-Frequency Rendering

Project Sentinel now supports sustained high-frequency telemetry rendering without relying on whole-dashboard rerenders.

### Why WebSockets

WebSockets are used because telemetry is a continuous stream. They avoid the repeated overhead and latency of polling, and they let the frontend decouple message ingestion from browser paint cadence.

### Update Frequency

The backend broadcast cadence is configurable with `TELEMETRY_BROADCAST_HZ`.

- Default: `20`
- Stress validation targets: `20`, `50`, `100`

The backend reuses one snapshot per tick and one marshaled payload per broadcast cycle, then fans that payload out to all connected clients.

### Zustand Architecture

The frontend uses a centralized Zustand telemetry store.

- The WebSocket bridge writes telemetry batches into Zustand.
- Components subscribe only to the state slices they need.
- Cards, charts, route panels, and performance indicators update independently.

### Memoization Strategy

- Presentation components are wrapped in `React.memo`.
- Derived chart distribution data uses `useMemo`.
- Stable callbacks are provided with `useCallback`.
- The dashboard shell remains static while child panels subscribe directly to the store.

### Rolling History Buffer

Telemetry history is bounded and constant-space.

- `VITE_TELEMETRY_HISTORY_LIMIT` controls retained points.
- `VITE_CHART_SAMPLE_LIMIT` controls how many points are actually rendered.
- The store keeps only the newest N points and never allows unbounded chart growth.

### Chart Optimization Strategy

The chart pipeline is optimized for high-frequency input by:

- draining inbound telemetry on `requestAnimationFrame`,
- batching multiple messages into a single store commit,
- decimating history before rendering,
- disabling Recharts animation,
- and splitting chart subscriptions from metric-card subscriptions.

### Virtualization

`react-window` is not used because the application does not render any large table or scrolling list. The performance-sensitive surface is the live telemetry visualization path, and that path is now bounded, sampled, and selectively subscribed.

### Scalability Considerations

- Client send queues are configurable with `TELEMETRY_CLIENT_QUEUE_SIZE`.
- Slow WebSocket consumers are dropped rather than blocking the hub.
- The frontend exposes update rate, render rate, queue size, flush rate, and dropped frame indicators to spot pressure early.

### Stress-Test Mode

The frontend includes synthetic telemetry modes for browser validation:

```bash
cd frontend
npm run stress:20
npm run stress:50
npm run stress:100
```

These modes generate local telemetry at 20, 50, and 100 updates per second using the same Zustand pipeline as the live WebSocket stream.

## Notes

- No authentication, database, Redis, Kubernetes, Prometheus, or Grafana were added.
- The circuit breaker is implemented from scratch and does not use any external circuit breaker library.
- The backend uses the Go standard library for HTTP serving, reverse proxying, and timeouts.
