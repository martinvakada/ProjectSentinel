import { memo, useMemo } from "react";
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

const routeColors = ["#147a5b", "#d97706", "#b42318"];

function RPSChart({ history, metrics }) {
  const distributionData = useMemo(
    () => [
      { name: "Primary", value: metrics.primaryRequests },
      { name: "Secondary", value: metrics.secondaryRequests },
      { name: "Failed", value: metrics.failedRequests },
    ],
    [metrics.failedRequests, metrics.primaryRequests, metrics.secondaryRequests],
  );

  const historyData = useMemo(
    () =>
      history.map((entry) => ({
        time: entry.time,
        rps: entry.rps,
        latency: Number(entry.latency.toFixed(1)),
        total: entry.totalRequests,
        failed: entry.failedRequests,
      })),
    [history],
  );

  return (
    <section className="charts-grid">
      <article className="panel chart-panel">
        <div className="panel-label">RPS Chart</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d9e4dd" />
              <XAxis dataKey="time" stroke="#35544a" />
              <YAxis stroke="#35544a" />
              <Tooltip />
              <Line type="monotone" dataKey="rps" stroke="#0f766e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel chart-panel">
        <div className="panel-label">Latency Chart</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ead9cb" />
              <XAxis dataKey="time" stroke="#6b4f3d" />
              <YAxis stroke="#6b4f3d" />
              <Tooltip />
              <Area type="monotone" dataKey="latency" stroke="#c2410c" fill="#fdba74" fillOpacity={0.45} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel chart-panel">
        <div className="panel-label">Request Distribution</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={distributionData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
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

      <article className="panel chart-panel">
        <div className="panel-label">Request History</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6d3f1" />
              <XAxis dataKey="time" stroke="#4338ca" />
              <YAxis stroke="#4338ca" />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="failed" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}

export default memo(RPSChart);
