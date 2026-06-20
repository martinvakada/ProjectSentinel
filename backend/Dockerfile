FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /sentinel-backend ./cmd

FROM alpine:3.20

RUN adduser -D appuser

USER appuser
WORKDIR /app

COPY --from=builder /sentinel-backend /usr/local/bin/sentinel-backend

EXPOSE 8080

CMD ["sentinel-backend"]
