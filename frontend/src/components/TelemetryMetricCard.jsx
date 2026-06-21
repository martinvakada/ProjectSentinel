import { memo, useMemo } from "react";
import MetricsCard from "./MetricsCard";
import { useTelemetryStore } from "../store/telemetryStore";

function TelemetryMetricCard({ title, metricKey, accent, format }) {
  const selector = useMemo(() => (state) => state.metrics[metricKey], [metricKey]);
  const value = useTelemetryStore(selector);
  const renderedValue = format ? format(value) : value;

  return <MetricsCard title={title} value={renderedValue} accent={accent} />;
}

export default memo(TelemetryMetricCard);
