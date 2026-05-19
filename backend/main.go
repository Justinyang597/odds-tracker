package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"odds-tracker/cache"
	"odds-tracker/config"
	"odds-tracker/db"
	"odds-tracker/db/migrations"
	"odds-tracker/handlers"
	"odds-tracker/ingestion"
	"odds-tracker/models"
)

var sports = []string{
	"americanfootball_nfl",
	"basketball_nba",
	"baseball_mlb",
}

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Root context: cancelled on SIGINT/SIGTERM.
	// Passed to every goroutine so they all stop cleanly on shutdown.
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// --- Postgres ---
	slog.Info("connecting to postgres")
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("postgres connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("postgres connected")

	slog.Info("running migrations")
	if err := migrations.Run(ctx, pool); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")

	// --- Redis ---
	slog.Info("connecting to redis")
	redisClient, err := cache.New(ctx, cfg.RedisURL)
	if err != nil {
		slog.Error("redis connection failed", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()
	slog.Info("redis connected")

	// --- Movement channel ---
	// The spine of the concurrency design:
	//   poller goroutines  →  movementCh  →  SSE broadcaster  →  frontend clients
	//
	// Buffered so pollers can write without blocking if the broadcaster is
	// momentarily busy. 256 is generous — movements are infrequent.
	movementCh := make(chan models.LineMovement, 256)

	// --- SSE broadcaster ---
	// Runs in its own goroutine. Reads from movementCh and fans each event out
	// to all connected frontend clients. Using a goroutine here (rather than
	// doing it inline in the HTTP handler) means one broadcaster handles all
	// clients — we don't spawn a goroutine per client for the fan-out.
	broadcaster := handlers.NewBroadcaster()
	go broadcaster.Run(movementCh)

	// --- Pause flag ---
	// Shared between the pollers and the pause HTTP handler. Pollers skip their
	// API call when this is true, so toggling pause stops quota usage instantly.
	paused := new(atomic.Bool)

	// --- Active date ---
	// Controls which day's games the pollers request from The Odds API.
	// Protected by dateMu so the HTTP handler and pollers can safely read/write it
	// from different goroutines without a race condition.
	// We use a plain RWMutex + time.Time rather than sync/atomic because atomic
	// only supports primitive types — time.Time is a struct.
	var dateMu sync.RWMutex
	activeDate := time.Now().UTC().Truncate(24 * time.Hour)

	getDate := func() time.Time {
		dateMu.RLock()
		defer dateMu.RUnlock()
		return activeDate
	}

	setDate := func(d time.Time) {
		dateMu.Lock()
		defer dateMu.Unlock()
		activeDate = d.UTC().Truncate(24 * time.Hour)
		slog.Info("active date changed", "date", activeDate.Format("2006-01-02"))
	}

	// --- Pollers ---
	ingestion.Start(ctx, cfg, pool, redisClient, movementCh, paused, getDate, sports)

	// --- Gin router ---
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// CORS: allow the Next.js frontend (localhost:3000) to call this API.
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	oddsH := handlers.NewOddsHandler(pool)
	pauseH := handlers.NewPauseHandler(paused)
	dateH := handlers.NewDateHandler(getDate, setDate)

	r.GET("/api/odds", oddsH.GetOddsBySport)
	r.GET("/api/odds/:game_id/history", oddsH.GetOddsHistory)
	r.GET("/api/odds/:game_id", oddsH.GetOddsByGame)
	r.GET("/api/movements", oddsH.GetMovements)
	r.GET("/api/movements/:game_id", oddsH.GetMovementsByGame)
	r.GET("/api/stream", broadcaster.Stream)
	r.GET("/api/pause", pauseH.Status)
	r.POST("/api/pause", pauseH.Toggle)
	r.GET("/api/date", dateH.Get)
	r.POST("/api/date", dateH.Set)

	// --- HTTP server with graceful shutdown ---
	// We don't use r.Run() because it blocks and can't be stopped cleanly.
	// Instead we start http.Server manually so we can call Shutdown() on signal.
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start serving in a goroutine so main can block on the shutdown signal.
	go func() {
		slog.Info("server listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Block until shutdown signal arrives.
	<-ctx.Done()
	slog.Info("shutting down")

	// Give in-flight requests up to 10 seconds to complete before we close
	// the DB pool and Redis connection.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	// pool.Close() and redisClient.Close() run via defer above.
	slog.Info("goodbye")
}
