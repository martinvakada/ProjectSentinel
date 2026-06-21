import { useEffect, useRef } from "react";
import { takeRenderRate } from "../lib/renderTracker";
import { useTelemetryStore } from "../store/telemetryStore";

function resolveWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://localhost:8080/ws`;
}

function resolveTelemetryMode() {
  return import.meta.env.VITE_TELEMETRY_MODE === "stress" ? "stress" : "websocket";
}

function resolveStressHz() {
  const parsed = Number.parseInt(import.meta.env.VITE_TELEMETRY_STRESS_HZ ?? "20", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

function createStressTelemetry(sequence) {
  const timestamp = Date.now();
  const totalRequests = sequence;
  const secondaryWindow = Math.floor(sequence / 80) % 3 === 1;
  const failedWindow = Math.floor(sequence / 120) % 5 === 4;

  return {
    sequence,
    timestamp,
    rps: secondaryWindow ? 18 + (sequence % 7) : 28 + (sequence % 11),
    state: failedWindow ? "OPEN" : secondaryWindow ? "HALF_OPEN" : "CLOSED",
    currentRoute: failedWindow ? "unavailable" : secondaryWindow ? "secondary" : "primary",
    totalRequests,
    primaryRequests: secondaryWindow || failedWindow ? Math.max(0, totalRequests - Math.floor(sequence / 3)) : totalRequests,
    secondaryRequests: secondaryWindow ? Math.floor(sequence / 3) : failedWindow ? Math.floor(sequence / 4) : 0,
    failedRequests: failedWindow ? Math.floor(sequence / 8) : Math.floor(sequence / 20),
    latency: failedWindow ? 220 + (sequence % 40) : secondaryWindow ? 110 + (sequence % 20) : 18 + (sequence % 8),
    activeConnections: 1,
  };
}

export default function useWebSocket({ onError } = {}) {
  const setConnection = useTelemetryStore((state) => state.setConnection);
  const ingestBatch = useTelemetryStore((state) => state.ingestBatch);
  const updatePerformance = useTelemetryStore((state) => state.updatePerformance);
  const retryRef = useRef();
  const queueRef = useRef([]);

  useEffect(() => {
    let socket = null;
    let disposed = false;
    let animationFrameId = 0;
    let stressTimerId = 0;
    let sequence = 0;
    let lastFrameTime = 0;
    let lastStatsTime = performance.now();
    let updatesThisWindow = 0;
    let flushesThisWindow = 0;
    let droppedFramesThisWindow = 0;
    let peakQueueThisWindow = 0;
    let currentQueueSize = 0;

    const queueSample = (sample) => {
      queueRef.current.push(sample);
      currentQueueSize = queueRef.current.length;
      if (currentQueueSize > peakQueueThisWindow) {
        peakQueueThisWindow = currentQueueSize;
      }
      updatesThisWindow += 1;
    };

    const publishPerformance = (now) => {
      const elapsed = Math.max(now - lastStatsTime, 1);
      updatePerformance({
        wsUpdateRate: Math.round((updatesThisWindow * 1000) / elapsed),
        renderRate: Math.round(takeRenderRate(now)),
        queueSize: currentQueueSize,
        peakQueueSize: peakQueueThisWindow,
        droppedFrames: droppedFramesThisWindow,
        flushRate: Math.round((flushesThisWindow * 1000) / elapsed),
      });
      updatesThisWindow = 0;
      flushesThisWindow = 0;
      droppedFramesThisWindow = 0;
      peakQueueThisWindow = currentQueueSize;
      lastStatsTime = now;
    };

    const flushQueue = (now) => {
      if (disposed) {
        return;
      }

      if (lastFrameTime !== 0) {
        const frameDelta = now - lastFrameTime;
        if (frameDelta > 20) {
          droppedFramesThisWindow += Math.max(0, Math.round(frameDelta / 16.67) - 1);
        }
      }
      lastFrameTime = now;

      if (queueRef.current.length > 0) {
        const batch = queueRef.current.splice(0, queueRef.current.length);
        currentQueueSize = 0;
        flushesThisWindow += 1;
        ingestBatch(batch);
      }

      if (now - lastStatsTime >= 1000) {
        publishPerformance(now);
      }

      animationFrameId = window.requestAnimationFrame(flushQueue);
    };

    const connect = () => {
      socket = new WebSocket(resolveWebSocketUrl());

      socket.onopen = () => {
        if (disposed) {
          return;
        }

        setConnection(true);
      };

      socket.onmessage = (event) => {
        if (disposed) {
          return;
        }

        queueSample(JSON.parse(event.data));
      };

      socket.onerror = (event) => {
        if (disposed) {
          return;
        }

        onError?.(event);
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }

        setConnection(false);
        retryRef.current = window.setTimeout(connect, 1500);
      };
    };

    const mode = resolveTelemetryMode();
    animationFrameId = window.requestAnimationFrame(flushQueue);

    if (mode === "stress") {
      setConnection(true);
      const stressHz = resolveStressHz();
      const period = 1000 / stressHz;
      stressTimerId = window.setInterval(() => {
        sequence += 1;
        queueSample(createStressTelemetry(sequence));
      }, period);
    } else {
      connect();
    }

    return () => {
      disposed = true;
      setConnection(false);
      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
      }
      if (stressTimerId) {
        window.clearInterval(stressTimerId);
      }
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [ingestBatch, onError, setConnection, updatePerformance]);
}
