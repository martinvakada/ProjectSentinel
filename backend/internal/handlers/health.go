package handlers

import (
	"net/http"
	"projectsentinel/backend/internal/circuitbreaker"
	"projectsentinel/backend/internal/config"
)

type HealthHandler struct {
	cfg     config.Config
	breaker *circuitbreaker.Breaker
}

func NewHealthHandler(cfg config.Config, breaker *circuitbreaker.Breaker) *HealthHandler {
	return &HealthHandler{
		cfg:     cfg,
		breaker: breaker,
	}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":        "ok",
		"state":         h.breaker.State(),
		"primaryApi":    h.cfg.PrimaryAPIURL,
		"secondaryApi":  h.cfg.SecondaryAPIURL,
		"requestTimeout": h.cfg.RequestTimeout.String(),
	})
}
