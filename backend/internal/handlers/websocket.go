package handlers

import (
	"net/http"
	"projectsentinel/backend/internal/metrics"
	ws "projectsentinel/backend/internal/websocket"
)

type WebSocketHandler struct {
	hub       *ws.Hub
	collector *metrics.Collector
}

func NewWebSocketHandler(hub *ws.Hub, collector *metrics.Collector) *WebSocketHandler {
	return &WebSocketHandler{
		hub:       hub,
		collector: collector,
	}
}

func (h *WebSocketHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	client, err := ws.Upgrade(w, r, h.hub, h.collector)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
