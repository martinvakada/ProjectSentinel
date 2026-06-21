import { memo } from "react";
import { useTelemetryStore } from "../store/telemetryStore";

const stateCopy = {
  CLOSED: "Traffic is flowing through the primary API.",
  OPEN: "Primary API is bypassed and fallback routing is active.",
  HALF_OPEN: "A recovery probe is testing the primary API.",
};

const selectState = (state) => state.metrics.state;

function CircuitBreakerCard() {
  const state = useTelemetryStore(selectState);
  const normalizedState = state || "CLOSED";

  return (
    <section className={`panel state-panel state-${normalizedState.toLowerCase()}`}>
      <div className="panel-label">Circuit Breaker</div>
      <div className="state-badge">{normalizedState}</div>
      <p className="panel-copy">{stateCopy[normalizedState] ?? stateCopy.CLOSED}</p>
    </section>
  );
}

export default memo(CircuitBreakerCard);
