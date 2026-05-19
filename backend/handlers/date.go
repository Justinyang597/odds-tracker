package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// DateHandler exposes GET/POST /api/date so the frontend can read and change
// which day's games the pollers fetch.
//
// getDate and setDate are closures that wrap a mutex-protected time.Time in main.
// Passing functions (rather than a shared struct) keeps the concurrency contract
// explicit: the caller owns the lock, this handler just calls in.
type DateHandler struct {
	getDate func() time.Time
	setDate func(time.Time)
}

func NewDateHandler(getDate func() time.Time, setDate func(time.Time)) *DateHandler {
	return &DateHandler{getDate: getDate, setDate: setDate}
}

// Get returns the current active polling date as {"date": "2026-05-18"}.
func (h *DateHandler) Get(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"date": h.getDate().UTC().Format("2006-01-02")})
}

// Set updates the active polling date from a JSON body {"date": "2026-05-18"}.
// The change takes effect on the very next poll tick — no restart required.
func (h *DateHandler) Set(c *gin.Context) {
	var body struct {
		Date string `json:"date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	parsed, err := time.Parse("2006-01-02", body.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return
	}

	h.setDate(parsed.UTC())
	c.JSON(http.StatusOK, gin.H{"date": parsed.UTC().Format("2006-01-02")})
}
