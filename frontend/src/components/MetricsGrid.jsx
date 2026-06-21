import { memo, useMemo } from "react";
import TelemetryMetricCard from "./TelemetryMetricCard";

const metricCards = [
  { title: "Requests / Second", metricKey: "rps", accent: "accent-sand" },
  { title: "Total Requests", metricKey: "totalRequests", accent: "accent-blue" },
  { title: "Primary Requests", metricKey: "primaryRequests", accent: "accent-green" },
  { title: "Secondary Requests", metricKey: "secondaryRequests", accent: "accent-amber" },
  { title: "Failed Requests", metricKey: "failedRequests", accent: "accent-red" },
  {
    title: "Average Latency",
    metricKey: "latency",
    accent: "accent-slate",
    format: (value) => `${value.toFixed(1)} ms`,
  },
  { title: "Active Connections", metricKey: "activeConnections", accent: "accent-indigo" },
];

function MetricsGrid() {
  const cards = useMemo(() => metricCards, []);

  return (
    <section className="metrics-grid">
      {cards.map((card) => (
        <TelemetryMetricCard
          key={card.title}
          title={card.title}
          metricKey={card.metricKey}
          accent={card.accent}
          format={card.format}
        />
      ))}
    </section>
  );
}

export default memo(MetricsGrid);
