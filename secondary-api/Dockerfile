FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /secondary-api .

FROM alpine:3.20

RUN adduser -D appuser

USER appuser

COPY --from=builder /secondary-api /usr/local/bin/secondary-api

EXPOSE 8082

CMD ["secondary-api"]
