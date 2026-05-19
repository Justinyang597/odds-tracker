package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/gin-gonic/gin"

	"odds-tracker/models"
)

// Broadcaster manages the set of connected SSE clients and fans movement
// events out to all of them.
//
// Why SSE instead of WebSockets:
// Line movements are server-to-client only — the frontend never needs to send
// data upstream. SSE is unidirectional, requires no handshake or upgrade, and
// works natively in every browser via EventSource. WebSockets would add
// bidirectional complexity for zero gain here.
type Broadcaster struct {
	mu      sync.Mutex
	clients map[chan string]struct{} // each connected client gets its own channel
}

// NewBroadcaster creates a Broadcaster ready to accept clients.
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		clients: make(map[chan string]struct{}),
	}
}

// Run reads from movementCh and fans each event out to all connected clients.
// It runs in its own goroutine for the lifetime of the server.
// When ctx is cancelled it exits, leaving client channels to drain naturally.
func (b *Broadcaster) Run(movementCh <-chan models.LineMovement) {
	for movement := range movementCh {
		data, err := json.Marshal(movement)
		if err != nil {
			slog.Error("broadcaster: marshal failed", "error", err)
			continue
		}

		// SSE event format: "data: <json>\n\n"
		msg := fmt.Sprintf("data: %s\n\n", data)

		b.mu.Lock()
		for ch := range b.clients {
			// Non-blocking send: if a client's channel is full (slow consumer),
			// we skip it rather than blocking the broadcaster for everyone else.
			select {
			case ch <- msg:
			default:
				slog.Warn("broadcaster: client channel full, skipping")
			}
		}
		b.mu.Unlock()
	}
}

// Stream is the Gin handler for GET /api/stream.
// It registers the client, streams events, and deregisters on disconnect.
func (b *Broadcaster) Stream(c *gin.Context) {
	// Each client gets a buffered channel. Buffer of 32 handles short bursts
	// of movements without dropping, while bounding memory per connection.
	clientCh := make(chan string, 32)

	b.mu.Lock()
	b.clients[clientCh] = struct{}{}
	b.mu.Unlock()

	// Always remove the client when the handler exits — whether the client
	// disconnected, the server is shutting down, or an error occurred.
	defer func() {
		b.mu.Lock()
		delete(b.clients, clientCh)
		b.mu.Unlock()
		close(clientCh)
	}()

	// Set SSE headers before writing any body.
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	// Send an initial comment to confirm the connection is open.
	// Some browsers and proxies buffer until the first bytes arrive.
	fmt.Fprint(c.Writer, ": connected\n\n")
	c.Writer.Flush()

	// clientGone is signalled when the HTTP connection closes (browser tab
	// closed, network drop, etc.). We use it to exit the loop cleanly.
	clientGone := c.Request.Context().Done()

	for {
		select {
		case msg, ok := <-clientCh:
			if !ok {
				return
			}
			fmt.Fprint(c.Writer, msg)
			c.Writer.Flush()

		case <-clientGone:
			// Client disconnected — the deferred cleanup handles removal.
			return
		}
	}
}
