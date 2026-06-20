import { memo } from "react";

function MetricsCard({ title, value, accent }) {
  return (
    <section className={`panel metric-panel ${accent}`}>
      <div className="panel-label">{title}</div>
      <div className="metric-value">{value}</div>
    </section>
  );
}

export default memo(MetricsCard);
