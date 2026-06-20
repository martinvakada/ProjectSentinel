import { memo, useCallback, useMemo } from "react";
import CircuitBreakerCard from "./CircuitBreakerCard";
import MetricsCard from "./MetricsCard";
import RouteCard from "./RouteCard";
import RPSChart from "./RPSChart";
import useWebSocket from "../hooks/useWebSocket";

const initialMetrics = {
  rps: 0,
  state: "CLOSED",
  currentRoute: "primary",
  totalRequests: 0,
  primaryRequests: 0,
  secondaryRequests: 0,
  failedRequests: 0,
  latency: 0,
  activeConnections: 0,
};

function Dashboard() {
  const handleError = useCallback((error) => {
    console.error("websocket error", error);
  }, []);

  const { connected, metrics, history } = useWebSocket(initialMetrics, handleError);

  const cards = useMemo(
    () => [
      { title: "Requests / Second", value: metrics.rps, accent: "accent-sand" },
      { title: "Total Requests", value: metrics.totalRequests, accent: "accent-blue" },
      { title: "Primary Requests", value: metrics.primaryRequests, accent: "accent-green" },
      { title: "Secondary Requests", value: metrics.secondaryRequests, accent: "accent-amber" },
      { title: "Failed Requests", value: metrics.failedRequests, accent: "accent-red" },
      { title: "Average Latency", value: `${metrics.latency.toFixed(1)} ms`, accent: "accent-slate" },
      { title: "Active Connections", value: metrics.activeConnections, accent: "accent-indigo" },
    ],
    [metrics],
  );

  const statusText = connected ? "Live telemetry connected" : "Reconnecting to telemetry";

  return (
    <main className="dashboard-shell">
      <header className="hero">
        <div>
          <div className="eyebrow">Project Sentinel</div>
          <h1>War Room Dashboard</h1>
          <p className="hero-copy">
            Live monitoring for the API multiplexer, custom circuit breaker, and fallback routing.
          </p>
        </div>
        <div className={`connection-pill ${connected ? "connected" : "disconnected"}`}>{statusText}</div>
      </header>

      <section className="top-grid">
        <CircuitBreakerCard state={metrics.state} />
        <RouteCard
          route={metrics.currentRoute}
          primaryRequests={metrics.primaryRequests}
          secondaryRequests={metrics.secondaryRequests}
          failedRequests={metrics.failedRequests}
        />
      </section>

      <section className="metrics-grid">
        {cards.map((card) => (
          <MetricsCard key={card.title} title={card.title} value={card.value} accent={card.accent} />
        ))}
      </section>

      <RPSChart history={history} metrics={metrics} />
    </main>
  );
}

export default memo(Dashboard);
