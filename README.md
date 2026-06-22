# Project Sentinel

Project Sentinel is a high-performance Go API multiplexer that routes traffic to a primary API, trips a custom circuit breaker when the primary becomes unhealthy, falls back to a secondary API, and streams live telemetry to a React dashboard over WebSockets.

## Demo Video
This video demonstrates the complete Project Sentinel workflow, including:

* Normal traffic routing through the Primary API
* Real-time dashboard updates via WebSockets
* Toxiproxy latency injection
* Circuit Breaker state transitions (`CLOSED → OPEN → HALF_OPEN`)
* Automatic failover to the Secondary API
* Recovery after fault removal and traffic restoration

Demo Video: <https://www.loom.com/share/fbc51d9a91b341ea808f91b7022f1a0a>

## Architecture Diagram

```text
Client
  |
  v
Frontend Dashboard (React)
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

Project Sentinel uses Toxiproxy to simulate failures on the primary API and validate circuit breaker behavior under load.

### Step 1: Generate Baseline Traffic

Verify that requests are successfully routed to the Primary API.

```bash
hey -n 2000 -c 10 http://localhost:8080/api/data
```

Expected result:

* Circuit Breaker state remains `CLOSED`
* Requests are routed to the Primary API
* Dashboard shows healthy latency and normal traffic distribution

---

### Step 2: Inject 1000ms Latency Using Toxiproxy

Introduce artificial latency on the Primary API.

```bash
curl -X POST http://localhost:8474/proxies/primary_api/toxics ^
-H "User-Agent: toxiproxy-cli" ^
-H "Content-Type: application/json" ^
-d "{\"name\":\"latency_test\",\"type\":\"latency\",\"attributes\":{\"latency\":1000}}"
```

Expected result:

* Primary API responses exceed the backend timeout (`200ms`)
* Requests begin failing against the Primary API
* Failure count increases in the Circuit Breaker

---

### Step 3: Generate Traffic During Failure

```bash
hey -n 2000 -c 10 http://localhost:8080/api/data
```

Expected result:

* Circuit Breaker reaches the failure threshold
* Circuit Breaker transitions from `CLOSED` → `OPEN`
* Requests are automatically routed to the Secondary API
* Dashboard displays:

  * Breaker State: `OPEN`
  * Active Route: `Secondary API`
  * Increased failure count
  * Shift in traffic distribution

---

### Step 4: Remove the Failure

Restore normal connectivity to the Primary API.

```bash
curl -X DELETE http://localhost:8474/proxies/primary_api/toxics/latency_test ^
-H "User-Agent: toxiproxy-cli"
```

Expected result:

* Artificial latency is removed
* Primary API becomes healthy again

---

### Step 5: Generate Traffic After Recovery

```bash
hey -n 1000 -c 10 http://localhost:8080/api/data
```

Expected result:

* After the configured open duration, the breaker enters `HALF_OPEN`

* A probe request is sent to the Primary API

* Successful response causes the breaker to transition:

  ```
  OPEN → HALF_OPEN → CLOSED
  ```

* Traffic gradually returns to the Primary API

* Dashboard reflects the recovery in real time

---

### Chaos Test Flow

```text
Primary API Healthy
        ↓
Generate Traffic
        ↓
Inject 1000ms Latency (Toxiproxy)
        ↓
Primary Requests Timeout (>200ms)
        ↓
Circuit Breaker OPEN
        ↓
Traffic Routed to Secondary API
        ↓
Remove Latency
        ↓
HALF_OPEN Probe
        ↓
Circuit Breaker CLOSED
        ↓
Traffic Returns to Primary API
```

## Frontend Overview

-## Frontend Overview

* `useWebSocket.js` manages the WebSocket connection and receives live telemetry data.
* `Dashboard.jsx` organizes and displays all dashboard components.
* `CircuitBreakerCard.jsx` shows the current circuit breaker state (`CLOSED`, `OPEN`, `HALF_OPEN`).
* `RouteCard.jsx` displays whether traffic is routed to the Primary or Secondary API.
* `MetricsCard.jsx` shows key metrics such as requests, latency, and failures.
* `RPSChart.jsx` visualizes request rate, latency, and traffic distribution using Recharts.

## React Rendering Approach

### Why WebSockets?

The dashboard receives live updates from the backend through WebSockets. This provides real-time telemetry without the overhead of repeated API polling.

### State Management

The frontend uses Zustand to store telemetry data.

* WebSocket messages update the Zustand store.
* Components subscribe only to the data they need.
* This reduces unnecessary re-renders.

### Performance Optimizations

To keep the dashboard responsive during heavy traffic:

* `React.memo` prevents unnecessary component re-renders.
* `useMemo` is used for derived chart data.
* Telemetry history is limited to a fixed number of points.
* Recharts animations are disabled for smoother real-time updates.

### Result

The dashboard can display real-time metrics, circuit breaker state changes, and traffic routing updates efficiently even under high request loads.
