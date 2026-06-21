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
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

type Config struct {
	BroadcastHz     int
	ClientQueueSize int
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
	interval   time.Duration
	queueSize  int
}

func NewHub(collector *metrics.Collector, breaker *circuitbreaker.Breaker, cfg Config) *Hub {
	broadcastHz := cfg.BroadcastHz
	if broadcastHz <= 0 {
		broadcastHz = 20
	}

	queueSize := cfg.ClientQueueSize
	if queueSize <= 0 {
		queueSize = 128
	}

	return &Hub{
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]struct{}),
		collector:  collector,
		breaker:    breaker,
		interval:   time.Second / time.Duration(broadcastHz),
		queueSize:  queueSize,
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) newClient(conn *websocket.Conn) *Client {
	return &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, h.queueSize),
	}
}

func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	var snapshot metrics.Snapshot
	var sequence uint64

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
			sequence++
			h.collector.SnapshotCopy(h.breaker.State().String(), &snapshot, sequence, time.Now().UnixMilli())

			payload, err := json.Marshal(&snapshot)
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
