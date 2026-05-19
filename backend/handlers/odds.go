package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OddsHandler holds the DB pool used by the REST handlers.
type OddsHandler struct {
	pool *pgxpool.Pool
}

// NewOddsHandler creates an OddsHandler.
func NewOddsHandler(pool *pgxpool.Pool) *OddsHandler {
	return &OddsHandler{pool: pool}
}

// GetOddsBySport handles GET /api/odds?sport=NFL&date=2026-05-18
// Returns the most recent snapshot per game/bookmaker/market/outcome for a sport on the given date.
func (h *OddsHandler) GetOddsBySport(c *gin.Context) {
	sport := c.Query("sport")
	if sport == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sport query param required"})
		return
	}

	// Parse optional date param; default to today UTC.
	// The window matches fetchOdds: midnight UTC → next-day noon UTC, which covers
	// late US evening games that start after UTC midnight.
	dateStr := c.DefaultQuery("date", time.Now().UTC().Format("2006-01-02"))
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return
	}
	from := date.UTC().Add(8 * time.Hour)  // 08:00 UTC = 4 AM ET; matches fetchOdds window
	to := date.UTC().AddDate(0, 0, 1).Add(12 * time.Hour)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// DISTINCT ON keeps only the latest snapshot per unique combination.
	// This is more efficient than a subquery for this access pattern.
	rows, err := h.pool.Query(ctx, `
		SELECT DISTINCT ON (game_id, bookmaker, market, outcome)
			game_id, home_team, away_team, commence_at,
			bookmaker, market, outcome, price, point, captured_at
		FROM odds_snapshots
		WHERE sport = $1
		  AND commence_at >= $2
		  AND commence_at < $3
		ORDER BY game_id, bookmaker, market, outcome, captured_at DESC
	`, sport, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type row struct {
		GameID     string   `json:"game_id"`
		HomeTeam   string   `json:"home_team"`
		AwayTeam   string   `json:"away_team"`
		CommenceAt string   `json:"commence_at"`
		Bookmaker  string   `json:"bookmaker"`
		Market     string   `json:"market"`
		Outcome    string   `json:"outcome"`
		Price      float64  `json:"price"`
		Point      *float64 `json:"point,omitempty"`
		CapturedAt string   `json:"captured_at"`
	}

	var results []row
	for rows.Next() {
		var r row
		var commenceAt, capturedAt time.Time
		if err := rows.Scan(
			&r.GameID, &r.HomeTeam, &r.AwayTeam, &commenceAt,
			&r.Bookmaker, &r.Market, &r.Outcome, &r.Price, &r.Point, &capturedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		r.CommenceAt = commenceAt.Format(time.RFC3339)
		r.CapturedAt = capturedAt.Format(time.RFC3339)
		results = append(results, r)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "rows error"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GetOddsByGame handles GET /api/odds/:game_id
// Returns the latest odds for one game across all bookmakers.
func (h *OddsHandler) GetOddsByGame(c *gin.Context) {
	gameID := c.Param("game_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx, `
		SELECT DISTINCT ON (bookmaker, market, outcome)
			game_id, home_team, away_team, commence_at,
			bookmaker, market, outcome, price, point, captured_at
		FROM odds_snapshots
		WHERE game_id = $1
		ORDER BY bookmaker, market, outcome, captured_at DESC
	`, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type row struct {
		GameID     string   `json:"game_id"`
		HomeTeam   string   `json:"home_team"`
		AwayTeam   string   `json:"away_team"`
		CommenceAt string   `json:"commence_at"`
		Bookmaker  string   `json:"bookmaker"`
		Market     string   `json:"market"`
		Outcome    string   `json:"outcome"`
		Price      float64  `json:"price"`
		Point      *float64 `json:"point,omitempty"`
		CapturedAt string   `json:"captured_at"`
	}

	var results []row
	for rows.Next() {
		var r row
		var commenceAt, capturedAt time.Time
		if err := rows.Scan(
			&r.GameID, &r.HomeTeam, &r.AwayTeam, &commenceAt,
			&r.Bookmaker, &r.Market, &r.Outcome, &r.Price, &r.Point, &capturedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		r.CommenceAt = commenceAt.Format(time.RFC3339)
		r.CapturedAt = capturedAt.Format(time.RFC3339)
		results = append(results, r)
	}

	c.JSON(http.StatusOK, results)
}

// GetMovements handles GET /api/movements?limit=50
// Returns recent line movements across all sports.
func (h *OddsHandler) GetMovements(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx, `
		SELECT game_id, bookmaker, market, outcome,
		       old_price, new_price, old_point, new_point, moved_at
		FROM line_movements
		ORDER BY moved_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type row struct {
		GameID    string   `json:"game_id"`
		Bookmaker string   `json:"bookmaker"`
		Market    string   `json:"market"`
		Outcome   string   `json:"outcome"`
		OldPrice  float64  `json:"old_price"`
		NewPrice  float64  `json:"new_price"`
		OldPoint  *float64 `json:"old_point,omitempty"`
		NewPoint  *float64 `json:"new_point,omitempty"`
		MovedAt   string   `json:"moved_at"`
	}

	var results []row
	for rows.Next() {
		var r row
		var movedAt time.Time
		if err := rows.Scan(
			&r.GameID, &r.Bookmaker, &r.Market, &r.Outcome,
			&r.OldPrice, &r.NewPrice, &r.OldPoint, &r.NewPoint, &movedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		r.MovedAt = movedAt.Format(time.RFC3339)
		results = append(results, r)
	}

	c.JSON(http.StatusOK, results)
}

// GetOddsHistory handles GET /api/odds/:game_id/history?market=h2h
// Returns all snapshots for a game/market combo ordered by time — used by the chart.
func (h *OddsHandler) GetOddsHistory(c *gin.Context) {
	gameID := c.Param("game_id")
	market := c.DefaultQuery("market", "h2h")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx, `
		SELECT bookmaker, outcome, price, point, captured_at
		FROM odds_snapshots
		WHERE game_id = $1 AND market = $2
		ORDER BY captured_at ASC
	`, gameID, market)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type row struct {
		Bookmaker  string   `json:"bookmaker"`
		Outcome    string   `json:"outcome"`
		Price      float64  `json:"price"`
		Point      *float64 `json:"point,omitempty"`
		CapturedAt string   `json:"captured_at"`
	}

	var results []row
	for rows.Next() {
		var r row
		var capturedAt time.Time
		if err := rows.Scan(&r.Bookmaker, &r.Outcome, &r.Price, &r.Point, &capturedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		r.CapturedAt = capturedAt.Format(time.RFC3339)
		results = append(results, r)
	}

	c.JSON(http.StatusOK, results)
}

// GetMovementsByGame handles GET /api/movements/:game_id
// Returns all movements for a specific game, newest first.
func (h *OddsHandler) GetMovementsByGame(c *gin.Context) {
	gameID := c.Param("game_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx, `
		SELECT game_id, bookmaker, market, outcome,
		       old_price, new_price, old_point, new_point, moved_at
		FROM line_movements
		WHERE game_id = $1
		ORDER BY moved_at DESC
	`, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type row struct {
		GameID    string   `json:"game_id"`
		Bookmaker string   `json:"bookmaker"`
		Market    string   `json:"market"`
		Outcome   string   `json:"outcome"`
		OldPrice  float64  `json:"old_price"`
		NewPrice  float64  `json:"new_price"`
		OldPoint  *float64 `json:"old_point,omitempty"`
		NewPoint  *float64 `json:"new_point,omitempty"`
		MovedAt   string   `json:"moved_at"`
	}

	var results []row
	for rows.Next() {
		var r row
		var movedAt time.Time
		if err := rows.Scan(
			&r.GameID, &r.Bookmaker, &r.Market, &r.Outcome,
			&r.OldPrice, &r.NewPrice, &r.OldPoint, &r.NewPoint, &movedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan failed"})
			return
		}
		r.MovedAt = movedAt.Format(time.RFC3339)
		results = append(results, r)
	}

	c.JSON(http.StatusOK, results)
}
