import { create } from "zustand";

const DEFAULT_HISTORY_LIMIT = resolvePositiveInt(import.meta.env.VITE_TELEMETRY_HISTORY_LIMIT, 600);
const DEFAULT_CHART_SAMPLE_LIMIT = resolvePositiveInt(import.meta.env.VITE_CHART_SAMPLE_LIMIT, 180);

const initialMetrics = {
  sequence: 0,
  timestamp: 0,
  rps: 0,
  state: "CLOSED",
  currentRoute: "primary",
  totalRequests: 0,
  primaryRequests: 0,
  secondaryRequests: 0,
  failedRequests: 0,
  latency: 0,
  activeConnections: 0,
};

const historyBuffer = new Array(DEFAULT_HISTORY_LIMIT);
let historyCount = 0;
let historyCursor = 0;

function resolvePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pushHistoryPoint(point) {
  historyBuffer[historyCursor] = point;
  historyCursor = (historyCursor + 1) % DEFAULT_HISTORY_LIMIT;
  if (historyCount < DEFAULT_HISTORY_LIMIT) {
    historyCount += 1;
  }
}

function readHistory() {
  if (historyCount === 0) {
    return [];
  }

  const points = new Array(historyCount);
  const start = historyCount === DEFAULT_HISTORY_LIMIT ? historyCursor : 0;

  for (let index = 0; index < historyCount; index += 1) {
    points[index] = historyBuffer[(start + index) % DEFAULT_HISTORY_LIMIT];
  }

  return points;
}

function decimateHistory(points, sampleLimit) {
  if (points.length <= sampleLimit) {
    return points;
  }

  const stride = Math.ceil(points.length / sampleLimit);
  const sampled = [];
  for (let index = 0; index < points.length; index += stride) {
    sampled.push(points[index]);
  }

  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled;
}

function toHistoryPoint(sample) {
  return {
    sequence: sample.sequence,
    timestamp: sample.timestamp,
    rps: sample.rps,
    latency: Number(sample.latency.toFixed(1)),
    totalRequests: sample.totalRequests,
    failedRequests: sample.failedRequests,
  };
}

export const useTelemetryStore = create((set, get) => ({
  connected: false,
  metrics: initialMetrics,
  history: [],
  historyLimit: DEFAULT_HISTORY_LIMIT,
  chartSampleLimit: DEFAULT_CHART_SAMPLE_LIMIT,
  performance: {
    wsUpdateRate: 0,
    renderRate: 0,
    queueSize: 0,
    peakQueueSize: 0,
    droppedFrames: 0,
    flushRate: 0,
  },
  setConnection(connected) {
    set((state) => (state.connected === connected ? state : { connected }));
  },
  ingestBatch(batch) {
    if (!batch || batch.length === 0) {
      return;
    }

    const latest = batch[batch.length - 1];
    for (const sample of batch) {
      pushHistoryPoint(toHistoryPoint(sample));
    }

    set((state) => ({
      metrics: latest,
      history: decimateHistory(readHistory(), state.chartSampleLimit),
    }));
  },
  updatePerformance(nextPerformance) {
    set((state) => ({
      performance: {
        ...state.performance,
        ...nextPerformance,
      },
    }));
  },
  reset() {
    historyCount = 0;
    historyCursor = 0;
    set({
      connected: false,
      metrics: initialMetrics,
      history: [],
      performance: {
        wsUpdateRate: 0,
        renderRate: 0,
        queueSize: 0,
        peakQueueSize: 0,
        droppedFrames: 0,
        flushRate: 0,
      },
    });
  },
}));
