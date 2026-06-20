package circuitbreaker

import (
	"sync"
	"time"
)

type Config struct {
	FailureThreshold int
	OpenDuration     time.Duration
}

type Breaker struct {
	mu               sync.Mutex
	state            State
	failures         int
	openedAt         time.Time
	openDuration     time.Duration
	failureThreshold int
	halfOpenProbe    bool
}

func New(cfg Config) *Breaker {
	threshold := cfg.FailureThreshold
	if threshold <= 0 {
		threshold = 5
	}

	duration := cfg.OpenDuration
	if duration <= 0 {
		duration = 10 * time.Second
	}

	return &Breaker{
		state:            StateClosed,
		openDuration:     duration,
		failureThreshold: threshold,
	}
}

func (b *Breaker) State() State {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.promoteHalfOpenIfReady()
	return b.state
}

func (b *Breaker) AllowPrimary() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.promoteHalfOpenIfReady()

	switch b.state {
	case StateClosed:
		return true
	case StateOpen:
		return false
	case StateHalfOpen:
		if b.halfOpenProbe {
			return false
		}

		b.halfOpenProbe = true
		return true
	default:
		return false
	}
}

func (b *Breaker) RecordSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()

	switch b.state {
	case StateClosed:
		b.failures = 0
	case StateHalfOpen:
		b.failures = 0
		b.halfOpenProbe = false
		b.state = StateClosed
	case StateOpen:
		b.promoteHalfOpenIfReady()
	}
}

func (b *Breaker) RecordFailure() {
	b.mu.Lock()
	defer b.mu.Unlock()

	switch b.state {
	case StateClosed:
		b.failures++
		if b.failures >= b.failureThreshold {
			b.open()
		}
	case StateHalfOpen:
		b.open()
	case StateOpen:
		b.openedAt = time.Now()
	}
}

func (b *Breaker) promoteHalfOpenIfReady() {
	if b.state == StateOpen && time.Since(b.openedAt) >= b.openDuration {
		b.state = StateHalfOpen
		b.halfOpenProbe = false
	}
}

func (b *Breaker) open() {
	b.state = StateOpen
	b.failures = 0
	b.halfOpenProbe = false
	b.openedAt = time.Now()
}
