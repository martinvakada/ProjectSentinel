import { memo } from "react";
import { useTelemetryStore } from "../store/telemetryStore";

const selectConnected = (state) => state.connected;

function ConnectionStatus() {
  const connected = useTelemetryStore(selectConnected);
  const statusText = connected ? "Live telemetry connected" : "Reconnecting to telemetry";

  return <div className={`connection-pill ${connected ? "connected" : "disconnected"}`}>{statusText}</div>;
}

export default memo(ConnectionStatus);
