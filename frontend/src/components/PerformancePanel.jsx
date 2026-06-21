import { memo } from "react";
import { shallow } from "zustand/shallow";
import { useTelemetryStore } from "../store/telemetryStore";

const selectPerformance = (state) => ({
  wsUpdateRate: state.performance.wsUpdateRate,
  renderRate: state.performance.renderRate,
  queueSize: state.performance.queueSize,
  peakQueueSize: state.performance.peakQueueSize,
  droppedFrames: state.performance.droppedFrames,
  flushRate: state.performance.flushRate,
  historyLimit: state.historyLimit,
  chartSampleLimit: state.chartSampleLimit,
});

function PerformancePanel() {
  const perf = useTelemetryStore(selectPerformance, shallow);

  return (
    <section className="performance-grid">
      <article className="panel">
        <div className="panel-label">WebSocket Update Rate</div>
        <div className="perf-value">{perf.wsUpdateRate} msg/s</div>
      </article>

      <article className="panel">
        <div className="panel-label">Dashboard Render Rate</div>
        <div className="perf-value">{perf.renderRate} commits/s</div>
      </article>

      <article className="panel">
        <div className="panel-label">Telemetry Queue</div>
        <div className="perf-value">{perf.queueSize}</div>
        <div className="perf-note">Peak this second: {perf.peakQueueSize}</div>
      </article>

      <article className="panel">
        <div className="panel-label">Dropped Frames</div>
        <div className="perf-value">{perf.droppedFrames}</div>
      </article>

      <article className="panel">
        <div className="panel-label">Flush Rate</div>
        <div className="perf-value">{perf.flushRate} fps</div>
      </article>

      <article className="panel">
        <div className="panel-label">Retention Limits</div>
        <div className="perf-value">
          {perf.historyLimit} / {perf.chartSampleLimit}
        </div>
        <div className="perf-note">History points / rendered chart samples</div>
      </article>
    </section>
  );
}

export default memo(PerformancePanel);
