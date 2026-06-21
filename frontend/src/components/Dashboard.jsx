import { memo } from "react";
import CircuitBreakerCard from "./CircuitBreakerCard";
import MetricsGrid from "./MetricsGrid";
import PerformancePanel from "./PerformancePanel";
import RouteCard from "./RouteCard";
import RPSChart from "./RPSChart";
import ConnectionStatus from "./ConnectionStatus";

function Dashboard() {
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
        <ConnectionStatus />
      </header>

      <section className="top-grid">
        <CircuitBreakerCard />
        <RouteCard />
      </section>

      <MetricsGrid />

      <PerformancePanel />

      <RPSChart />
    </main>
  );
}

export default memo(Dashboard);
