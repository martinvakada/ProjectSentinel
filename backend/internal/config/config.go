package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                     string
	PrimaryAPIURL            string
	SecondaryAPIURL          string
	RequestTimeout           time.Duration
	FailureThreshold         int
	OpenDuration             time.Duration
	TelemetryBroadcastHz     int
	TelemetryClientQueueSize int
	ToxiproxyAdminURL        string
	ToxiproxyProxyName       string
	ToxiproxyListen          string
	ToxiproxyUpstream        string
}

func Load() Config {
	return Config{
		Port:                     getenv("PORT", "8080"),
		PrimaryAPIURL:            getenv("PRIMARY_API_URL", "http://localhost:8081"),
		SecondaryAPIURL:          getenv("SECONDARY_API_URL", "http://localhost:8082"),
		RequestTimeout:           getenvDuration("REQUEST_TIMEOUT", 200*time.Millisecond),
		FailureThreshold:         getenvInt("FAILURE_THRESHOLD", 5),
		OpenDuration:             getenvDuration("OPEN_DURATION", 10*time.Second),
		TelemetryBroadcastHz:     getenvInt("TELEMETRY_BROADCAST_HZ", 20),
		TelemetryClientQueueSize: getenvInt("TELEMETRY_CLIENT_QUEUE_SIZE", 128),
		ToxiproxyAdminURL:        os.Getenv("TOXIPROXY_ADMIN_URL"),
		ToxiproxyProxyName:       getenv("TOXIPROXY_PROXY_NAME", "primary_api"),
		ToxiproxyListen:          getenv("TOXIPROXY_LISTEN", "0.0.0.0:8666"),
		ToxiproxyUpstream:        getenv("TOXIPROXY_UPSTREAM", "primary-api:8081"),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func getenvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return parsed
}
