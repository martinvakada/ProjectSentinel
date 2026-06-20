package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"projectsentinel/backend/internal/circuitbreaker"
	"projectsentinel/backend/internal/metrics"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

type connectionTracker interface {
	IncrementConnections()
	DecrementConnections()
}

type Hub struct {
	register   chan *Client
	unregister chan *Client
	clients    map[*Client]struct{}
	collector  *metrics.Collector
	breaker    *circuitbreaker.Breaker
}

func NewHub(collector *metrics.Collector, breaker *circuitbreaker.Breaker) *Hub {
	return &Hub{
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]struct{}),
		collector:  collector,
		breaker:    breaker,
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				h.collector.DecrementConnections()
			}
		case <-ticker.C:
			payload, err := json.Marshal(h.collector.Snapshot(h.breaker.State()))
			if err != nil {
				continue
			}

			for client := range h.clients {
				select {
				case client.send <- payload:
				default:
					delete(h.clients, client)
					close(client.send)
					h.collector.DecrementConnections()
				}
			}
		case <-ctx.Done():
			for client := range h.clients {
				close(client.send)
			}
			return
		}
	}
}
