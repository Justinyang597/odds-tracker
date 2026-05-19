package handlers

import (
	"net/http"
	"sync/atomic"

	"github.com/gin-gonic/gin"
)

type PauseHandler struct {
	paused *atomic.Bool
}

func NewPauseHandler(paused *atomic.Bool) *PauseHandler {
	return &PauseHandler{paused: paused}
}

// Status returns the current paused state.
func (h *PauseHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"paused": h.paused.Load()})
}

// Toggle flips the paused state and returns the new value.
func (h *PauseHandler) Toggle(c *gin.Context) {
	// CAS loop handles the unlikely case of concurrent toggles.
	var next bool
	for {
		prev := h.paused.Load()
		next = !prev
		if h.paused.CompareAndSwap(prev, next) {
			break
		}
	}
	c.JSON(http.StatusOK, gin.H{"paused": next})
}
