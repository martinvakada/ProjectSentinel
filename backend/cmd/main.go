package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"projectsentinel/backend/internal/circuitbreaker"
	"projectsentinel/backend/internal/config"
	"projectsentinel/backend/internal/handlers"
	"projectsentinel/backend/internal/metrics"
	"projectsentinel/backend/internal/proxy"
	ws "projectsentinel/backend/internal/websocket"
	"syscall"
	"time"
)

func main() {
	cfg := config.Load()

	breaker := circuitbreaker.New(circuitbreaker.Config{
		FailureThreshold: cfg.FailureThreshold,
		OpenDuration:     cfg.OpenDuration,
	})

	collector := metrics.NewCollector()
	defer collector.Stop()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	if err := ensureToxiproxy(ctx, cfg); err != nil {
		log.Printf("toxiproxy bootstrap skipped: %v", err)
	}

	hub := ws.NewHub(collector, breaker, ws.Config{
		BroadcastHz:     cfg.TelemetryBroadcastHz,
		ClientQueueSize: cfg.TelemetryClientQueueSize,
	})
	go hub.Run(ctx)

	proxyService, err := proxy.NewService(proxy.Config{
		PrimaryURL:   cfg.PrimaryAPIURL,
		SecondaryURL: cfg.SecondaryAPIURL,
		Timeout:      cfg.RequestTimeout,
		Breaker:      breaker,
		Collector:    collector,
	})
	if err != nil {
		log.Fatalf("configure proxy: %v", err)
	}

	apiHandler := handlers.NewAPIHandler(proxyService, collector, breaker)
	healthHandler := handlers.NewHealthHandler(cfg, breaker)
	wsHandler := handlers.NewWebSocketHandler(hub, collector)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/data", apiHandler.Data)
	mux.HandleFunc("/metrics", apiHandler.Metrics)
	mux.HandleFunc("/health", healthHandler.Health)
	mux.HandleFunc("/ws", wsHandler.ServeWS)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	log.Printf("project sentinel backend listening on http://localhost:%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func ensureToxiproxy(ctx context.Context, cfg config.Config) error {
	if cfg.ToxiproxyAdminURL == "" {
		return nil
	}

	payload := map[string]string{
		"name":     cfg.ToxiproxyProxyName,
		"listen":   cfg.ToxiproxyListen,
		"upstream": cfg.ToxiproxyUpstream,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.ToxiproxyAdminURL+"/proxies", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusConflict {
		return nil
	}

	return errors.New("unexpected toxiproxy response: " + resp.Status)
}
