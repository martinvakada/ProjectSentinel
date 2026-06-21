import { memo, useMemo } from "react";
import { shallow } from "zustand/shallow";
import { useTelemetryStore } from "../store/telemetryStore";

const selectRouteMetrics = (state) => ({
  route: state.metrics.currentRoute,
  primaryRequests: state.metrics.primaryRequests,
  secondaryRequests: state.metrics.secondaryRequests,
  failedRequests: state.metrics.failedRequests,
});

function RouteCard() {
  const { route, primaryRequests, secondaryRequests, failedRequests } = useTelemetryStore(
    selectRouteMetrics,
    shallow,
  );

  const routeLabel = useMemo(() => {
    switch (route) {
      case "secondary":
        return "Secondary API";
      case "unavailable":
        return "No Healthy Upstream";
      default:
        return "Primary API";
    }
  }, [route]);

  return (
    <section className={`panel route-panel route-${route}`}>
      <div className="panel-label">Current Route</div>
      <div className="route-value">{routeLabel}</div>
      <div className="route-meta">
        <span>Primary: {primaryRequests}</span>
        <span>Secondary: {secondaryRequests}</span>
        <span>Failed: {failedRequests}</span>
      </div>
    </section>
  );
}

export default memo(RouteCard);
