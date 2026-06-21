package metrics

import (
	"sync"
	"time"
)

type Snapshot struct {
	Sequence          uint64  `json:"sequence"`
	Timestamp         int64   `json:"timestamp"`
	RPS               int     `json:"rps"`
	State             string  `json:"state"`
	CurrentRoute      string  `json:"currentRoute"`
	TotalRequests     uint64  `json:"totalRequests"`
	PrimaryRequests   uint64  `json:"primaryRequests"`
	SecondaryRequests uint64  `json:"secondaryRequests"`
	FailedRequests    uint64  `json:"failedRequests"`
	Latency           float64 `json:"latency"`
	ActiveConnections int     `json:"activeConnections"`
}

type Collector struct {
	mu                sync.RWMutex
	totalRequests     uint64
	primaryRequests   uint64
	secondaryRequests uint64
	failedRequests    uint64
	totalLatency      time.Duration
	requestsThisTick  int
	rps               int
	currentRoute      string
	activeConnections int
	stop              chan struct{}
}

func NewCollector() *Collector {
	c := &Collector{
		currentRoute: "primary",
		stop:         make(chan struct{}),
	}

	go c.runRPSLoop()
	return c
}

func (c *Collector) Stop() {
	select {
	case <-c.stop:
	default:
		close(c.stop)
	}
}

func (c *Collector) RecordPrimary(latency time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.totalRequests++
	c.primaryRequests++
	c.totalLatency += latency
	c.requestsThisTick++
	c.currentRoute = "primary"
}

func (c *Collector) RecordSecondary(latency time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.totalRequests++
	c.secondaryRequests++
	c.totalLatency += latency
	c.requestsThisTick++
	c.currentRoute = "secondary"
}

func (c *Collector) RecordFailure(latency time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.totalRequests++
	c.failedRequests++
	c.totalLatency += latency
	c.requestsThisTick++
	c.currentRoute = "unavailable"
}

func (c *Collector) IncrementConnections() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.activeConnections++
}

func (c *Collector) DecrementConnections() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.activeConnections > 0 {
		c.activeConnections--
	}
}

func (c *Collector) Snapshot(state any) Snapshot {
	var snapshot Snapshot
	c.FillSnapshot(&snapshot, stringifyState(state))
	return snapshot
}

func (c *Collector) FillSnapshot(dst *Snapshot, state string) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	averageLatency := 0.0
	if c.totalRequests > 0 {
		averageLatency = float64(c.totalLatency.Milliseconds()) / float64(c.totalRequests)
	}

	dst.RPS = c.rps
	dst.State = state
	dst.CurrentRoute = c.currentRoute
	dst.TotalRequests = c.totalRequests
	dst.PrimaryRequests = c.primaryRequests
	dst.SecondaryRequests = c.secondaryRequests
	dst.FailedRequests = c.failedRequests
	dst.Latency = averageLatency
	dst.ActiveConnections = c.activeConnections
}

func (c *Collector) SnapshotCopy(state string, dst *Snapshot, sequence uint64, timestamp int64) {
	dst.Sequence = sequence
	dst.Timestamp = timestamp
	c.FillSnapshot(dst, state)
}

func (c *Collector) runRPSLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.mu.Lock()
			c.rps = c.requestsThisTick
			c.requestsThisTick = 0
			c.mu.Unlock()
		case <-c.stop:
			return
		}
	}
}

func stringifyState(state any) string {
	switch value := state.(type) {
	case interface{ String() string }:
		return value.String()
	case string:
		return value
	default:
		return "UNKNOWN"
	}
}
