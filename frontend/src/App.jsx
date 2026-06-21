import { Profiler, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import useWebSocket from "./hooks/useWebSocket";
import { recordRenderCommit } from "./lib/renderTracker";

function App() {
  const handleTelemetryError = useCallback((error) => {
    console.error("telemetry stream error", error);
  }, []);

  useWebSocket({ onError: handleTelemetryError });

  return (
    <Profiler id="dashboard" onRender={recordRenderCommit}>
      <Dashboard />
    </Profiler>
  );
}

export default App;
