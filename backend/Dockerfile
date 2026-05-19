# Build stage: compile the Go binary.
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Download dependencies first (separate layer so Docker caches this unless
# go.mod/go.sum change, which speeds up rebuilds significantly).
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o odds-tracker .

# Runtime stage: minimal image with just the compiled binary.
FROM alpine:3.20

WORKDIR /app
COPY --from=builder /app/odds-tracker .

EXPOSE 8080
CMD ["./odds-tracker"]
