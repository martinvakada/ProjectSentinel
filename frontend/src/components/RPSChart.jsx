import { memo, useMemo } from "react";
import { shallow } from "zustand/shallow";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTelemetryStore } from "../store/telemetryStore";

const routeColors = ["#147a5b", "#d97706", "#b42318"];
const selectHistory = (state) => state.history;
const selectDistribution = (state) => ({
  primaryRequests: state.metrics.primaryRequests,
  secondaryRequests: state.metrics.secondaryRequests,
  failedRequests: state.metrics.failedRequests,
});

function formatSequence(value) {
  return `#${value}`;
}

function formatTimestamp(value) {
  return new Date(value).toLocaleTimeString([], {
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 1,
  });
}

const HistoryLinePanel = memo(function HistoryLinePanel() {
  const history = useTelemetryStore(selectHistory);

  return (
    <article className="panel chart-panel">
      <div className="panel-label">RPS Chart</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d9e4dd" />
            <XAxis dataKey="sequence" stroke="#35544a" tickFormatter={formatSequence} minTickGap={24} />
            <YAxis stroke="#35544a" />
            <Tooltip labelFormatter={(_, payload) => formatTimestamp(payload?.[0]?.payload?.timestamp ?? 0)} />
            <Line
              type="monotone"
              dataKey="rps"
              stroke="#0f766e"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
});

const LatencyPanel = memo(function LatencyPanel() {
  const history = useTelemetryStore(selectHistory);

  return (
    <article className="panel chart-panel">
      <div className="panel-label">Latency Chart</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ead9cb" />
            <XAxis dataKey="sequence" stroke="#6b4f3d" tickFormatter={formatSequence} minTickGap={24} />
            <YAxis stroke="#6b4f3d" />
            <Tooltip labelFormatter={(_, payload) => formatTimestamp(payload?.[0]?.payload?.timestamp ?? 0)} />
            <Area
              type="monotone"
              dataKey="latency"
              stroke="#c2410c"
              fill="#fdba74"
              fillOpacity={0.45}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
});

const DistributionPanel = memo(function DistributionPanel() {
  const distribution = useTelemetryStore(selectDistribution, shallow);
  const distributionData = useMemo(
    () => [
      { name: "Primary", value: distribution.primaryRequests },
      { name: "Secondary", value: distribution.secondaryRequests },
      { name: "Failed", value: distribution.failedRequests },
    ],
    [distribution.failedRequests, distribution.primaryRequests, distribution.secondaryRequests],
  );

  return (
    <article className="panel chart-panel">
      <div className="panel-label">Request Distribution</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={distributionData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              innerRadius={50}
              isAnimationActive={false}
            >
              {distributionData.map((entry, index) => (
                <Cell key={entry.name} fill={routeColors[index % routeColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
});

const RequestHistoryPanel = memo(function RequestHistoryPanel() {
  const history = useTelemetryStore(selectHistory);

  return (
    <article className="panel chart-panel">
      <div className="panel-label">Request History</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6d3f1" />
            <XAxis dataKey="sequence" stroke="#4338ca" tickFormatter={formatSequence} minTickGap={24} />
            <YAxis stroke="#4338ca" />
            <Tooltip labelFormatter={(_, payload) => formatTimestamp(payload?.[0]?.payload?.timestamp ?? 0)} />
            <Legend />
            <Bar dataKey="totalRequests" fill="#4f46e5" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="failedRequests" fill="#dc2626" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
});

function RPSChart() {
  return (
    <section className="charts-grid">
      <HistoryLinePanel />
      <LatencyPanel />
      <DistributionPanel />
      <RequestHistoryPanel />
    </section>
  );
}

export default memo(RPSChart);
