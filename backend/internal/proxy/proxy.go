package proxy

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"projectsentinel/backend/internal/circuitbreaker"
	"projectsentinel/backend/internal/metrics"
	"strings"
	"time"
)

var errPrimaryResponse = errors.New("primary upstream returned an error response")

type Config struct {
	PrimaryURL   string
	SecondaryURL string
	Timeout      time.Duration
	Breaker      *circuitbreaker.Breaker
	Collector    *metrics.Collector
}

type Service struct {
	primaryURL   *url.URL
	secondaryURL *url.URL
	timeout      time.Duration
	breaker      *circuitbreaker.Breaker
	collector    *metrics.Collector
	transport    http.RoundTripper
}

type bufferedResponse struct {
	statusCode int
	headers    http.Header
	body       []byte
}

func NewService(cfg Config) (*Service, error) {
	primaryURL, err := url.Parse(cfg.PrimaryURL)
	if err != nil {
		return nil, err
	}

	secondaryURL, err := url.Parse(cfg.SecondaryURL)
	if err != nil {
		return nil, err
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   500 * time.Millisecond,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &Service{
		primaryURL:   primaryURL,
		secondaryURL: secondaryURL,
		timeout:      cfg.Timeout,
		breaker:      cfg.Breaker,
		collector:    cfg.Collector,
		transport:    transport,
	}, nil
}

func (s *Service) ServeData(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	if s.breaker.AllowPrimary() {
		primaryResp, err := s.forward(r, s.primaryURL, s.timeout, true)
		if err == nil {
			s.breaker.RecordSuccess()
			s.collector.RecordPrimary(time.Since(start))
			writeBufferedResponse(w, primaryResp)
			return
		}

		s.breaker.RecordFailure()
	}

	secondaryResp, err := s.forward(r, s.secondaryURL, s.timeout, false)
	if err != nil {
		s.collector.RecordFailure(time.Since(start))
		writeProxyError(w, http.StatusBadGateway, "both upstream services are unavailable")
		return
	}

	s.collector.RecordSecondary(time.Since(start))
	writeBufferedResponse(w, secondaryResp)
}

func (s *Service) forward(r *http.Request, target *url.URL, timeout time.Duration, failOnServerError bool) (*bufferedResponse, error) {
	request := r.Clone(r.Context())
	request.URL.Path = "/data"
	request.URL.RawPath = ""
	request.URL.RawQuery = ""
	request.Host = target.Host

	ctx, cancel := contextWithOptionalTimeout(request.Context(), timeout)
	defer cancel()
	request = request.WithContext(ctx)

	var proxyErr error
	reverseProxy := httputil.NewSingleHostReverseProxy(target)
	reverseProxy.Transport = s.transport
	reverseProxy.ErrorHandler = func(_ http.ResponseWriter, _ *http.Request, err error) {
		proxyErr = err
	}
	reverseProxy.ModifyResponse = func(resp *http.Response) error {
		if failOnServerError && resp.StatusCode >= http.StatusInternalServerError {
			proxyErr = errPrimaryResponse
			return errPrimaryResponse
		}

		return nil
	}

	recorder := httptest.NewRecorder()
	reverseProxy.ServeHTTP(recorder, request)

	if proxyErr != nil {
		return nil, proxyErr
	}

	result := recorder.Result()
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, err
	}

	return &bufferedResponse{
		statusCode: result.StatusCode,
		headers:    result.Header.Clone(),
		body:       body,
	}, nil
}

func writeBufferedResponse(w http.ResponseWriter, response *bufferedResponse) {
	copyHeaders(w.Header(), response.headers)
	w.WriteHeader(response.statusCode)
	_, _ = w.Write(response.body)
}

func writeProxyError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + sanitizeJSON(message) + `"}`))
}

func copyHeaders(dst, src http.Header) {
	for key, values := range src {
		dst.Del(key)
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func sanitizeJSON(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	return strings.ReplaceAll(value, `"`, `\"`)
}

func contextWithOptionalTimeout(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if timeout <= 0 {
		return context.WithCancel(parent)
	}

	return context.WithTimeout(parent, timeout)
}
