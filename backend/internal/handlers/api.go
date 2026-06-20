package handlers

import (
	"encoding/json"
	"net/http"
	"projectsentinel/backend/internal/circuitbreaker"
	"projectsentinel/backend/internal/metrics"
	"projectsentinel/backend/internal/proxy"
)

type APIHandler struct {
	proxy     *proxy.Service
	collector *metrics.Collector
	breaker   *circuitbreaker.Breaker
}

func NewAPIHandler(proxyService *proxy.Service, collector *metrics.Collector, breaker *circuitbreaker.Breaker) *APIHandler {
	return &APIHandler{
		proxy:     proxyService,
		collector: collector,
		breaker:   breaker,
	}
}

func (h *APIHandler) Data(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	h.proxy.ServeData(w, r)
}

func (h *APIHandler) Metrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, h.collector.Snapshot(h.breaker.State()))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
