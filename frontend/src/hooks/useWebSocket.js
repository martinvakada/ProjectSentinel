import { useEffect, useRef, useState } from "react";

const HISTORY_LIMIT = 30;

function resolveWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://localhost:8080/ws`;
}

export default function useWebSocket(initialMetrics, onError) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef();

  useEffect(() => {
    let socket;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(resolveWebSocketUrl());

      socket.onopen = () => {
        if (disposed) {
          return;
        }

        setConnected(true);
      };

      socket.onmessage = (event) => {
        if (disposed) {
          return;
        }

        const nextMetrics = JSON.parse(event.data);
        setMetrics(nextMetrics);
        setHistory((previous) => {
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          const nextHistory = [
            ...previous,
            {
              ...nextMetrics,
              time: timestamp,
            },
          ];

          return nextHistory.slice(-HISTORY_LIMIT);
        });
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

        setConnected(false);
        retryRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      disposed = true;
      setConnected(false);
      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
      }
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [initialMetrics, onError]);

  return { connected, metrics, history };
}
