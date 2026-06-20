FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /primary-api .

FROM alpine:3.20

RUN adduser -D appuser

USER appuser

COPY --from=builder /primary-api /usr/local/bin/primary-api

EXPOSE 8081

CMD ["primary-api"]
