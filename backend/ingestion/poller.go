// Package ingestion handles periodic polling of The Odds API.
// The core pattern: one goroutine per sport, each running an infinite loop
// driven by a time.Ticker. When the context is cancelled (SIGINT/SIGTERM),
// every goroutine exits cleanly via a select on ctx.Done().
package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"odds-tracker/cache"
	"odds-tracker/config"
	"odds-tracker/detection"
	"odds-tracker/models"
)

// Offshore/unregulated books — only licensed US sportsbooks are tracked.
var excludedBookmakers = map[string]bool{
	"mybookieag": true,
	"betonlineag": true,
	"betus":       true,
	"bovada":      true,
	"lowvig":      true,
}

// Start launches one polling goroutine per sport and returns immediately.
// The goroutines run until ctx is cancelled.
//
// movementCh is a shared channel that all pollers write detected movements into.
// The SSE broadcaster (Phase 4) reads from this channel and fans out to clients.
// The channel is buffered so a slow broadcaster doesn't block a poller goroutine.
//
// getDate is called on every poll tick to get the currently-selected date.
// Changing it at runtime (via the /api/date endpoint) takes effect on the next tick.
func Start(
	ctx context.Context,
	cfg *config.Config,
	pool *pgxpool.Pool,
	redisClient *cache.Client,
	movementCh chan<- models.LineMovement,
	paused *atomic.Bool,
	getDate func() time.Time,
	sports []string,
) {
	for _, sport := range sports {
		// Capture the loop variable. In Go, goroutines launched inside a loop
		// share the same variable unless you copy it first. Without this line,
		// every goroutine would poll the same (last) sport.
		sport := sport
		go runPoller(ctx, cfg, pool, redisClient, movementCh, paused, getDate, sport)
	}
}

// runPoller is the body of one sport's goroutine. It polls on the configured
// interval and calls pollOnce on each tick. When any game for the sport has
// already started, it switches to liveInterval for faster updates.
// Errors are logged but never crash the goroutine.
func runPoller(
	ctx context.Context,
	cfg *config.Config,
	pool *pgxpool.Pool,
	redisClient *cache.Client,
	movementCh chan<- models.LineMovement,
	paused *atomic.Bool,
	getDate func() time.Time,
	sport string,
) {
	regularInterval := time.Duration(cfg.PollIntervalSeconds) * time.Second
	liveInterval := time.Duration(cfg.LivePollIntervalSeconds) * time.Second

	slog.Info("poller started", "sport", sport, "interval", regularInterval, "live_interval", liveInterval)

	// Poll once immediately so we don't wait a full interval on startup.
	hasLive := false
	if !paused.Load() {
		var err error
		hasLive, err = pollOnce(ctx, cfg, pool, redisClient, movementCh, getDate, sport)
		if err != nil {
			slog.Error("poll failed", "sport", sport, "error", err)
		}
	}

	for {
		interval := regularInterval
		if hasLive {
			interval = liveInterval
		}

		select {
		case <-time.After(interval):
		case <-ctx.Done():
			slog.Info("poller stopping", "sport", sport)
			return
		}

		if paused.Load() {
			slog.Debug("poll skipped (paused)", "sport", sport)
			hasLive = false
			continue
		}

		var err error
		hasLive, err = pollOnce(ctx, cfg, pool, redisClient, movementCh, getDate, sport)
		if err != nil {
			slog.Error("poll failed", "sport", sport, "error", err)
			hasLive = false
		}
	}
}

// pollOnce fetches current odds for one sport, diffs against Redis, writes
// snapshots only for changed odds, and sends detected movements to the channel.
// Returns true if any game in the response has already started (i.e. is live).
func pollOnce(
	ctx context.Context,
	cfg *config.Config,
	pool *pgxpool.Pool,
	redisClient *cache.Client,
	movementCh chan<- models.LineMovement,
	getDate func() time.Time,
	sport string,
) (bool, error) {
	games, err := fetchOdds(ctx, cfg, sport, getDate())
	if err != nil {
		return false, fmt.Errorf("fetch: %w", err)
	}

	if len(games) == 0 {
		slog.Info("no games returned", "sport", sport)
		return false, nil
	}

	now := time.Now()
	hasLive := false
	for _, g := range games {
		if g.CommenceTime.Before(now) {
			hasLive = true
			break
		}
	}

	snapshots, movements, err := diffGames(ctx, cfg, redisClient, sport, games)
	if err != nil {
		return false, fmt.Errorf("diff: %w", err)
	}

	// Only write to Postgres when something actually changed.
	// On the first poll everything is new (cache miss), so all outcomes are
	// written. On subsequent polls only changed outcomes produce writes.
	if len(snapshots) > 0 {
		if err := writeSnapshots(ctx, pool, snapshots); err != nil {
			return false, fmt.Errorf("write snapshots: %w", err)
		}
	}

	if len(movements) > 0 {
		if err := writeMovements(ctx, pool, movements); err != nil {
			return false, fmt.Errorf("write movements: %w", err)
		}

		// Fan detected movements out to the SSE broadcaster via the channel.
		// We use a non-blocking send so a slow or disconnected broadcaster
		// can't stall the poller goroutine.
		for _, m := range movements {
			select {
			case movementCh <- m:
			default:
				// Channel full: broadcaster is behind. Drop rather than block.
				slog.Warn("movement channel full, dropping event",
					"game_id", m.GameID, "bookmaker", m.Bookmaker)
			}
		}
	}

	slog.Info("poll complete",
		"sport", sport,
		"games", len(games),
		"live", hasLive,
		"changed", len(snapshots),
		"movements", len(movements),
	)
	return hasLive, nil
}

// diffGames iterates every outcome in the API response, compares against the
// Redis cache, updates the cache, and returns the changed snapshots + movements.
//
// Why Redis is the source of truth for "last known odds":
// The API returns ALL games on every poll regardless of whether they changed.
// Without Redis, we'd have to query Postgres for the latest price on every
// outcome every poll — expensive at scale. Redis gives us sub-millisecond reads.
func diffGames(
	ctx context.Context,
	cfg *config.Config,
	redisClient *cache.Client,
	sport string,
	games models.APIResponse,
) ([]models.OddsSnapshot, []models.LineMovement, error) {
	var snapshots []models.OddsSnapshot
	var movements []models.LineMovement

	for _, game := range games {
		for _, bookmaker := range game.Bookmakers {
			if excludedBookmakers[bookmaker.Key] {
				continue
			}
			for _, market := range bookmaker.Markets {
				for _, outcome := range market.Outcomes {
					newOdds := models.CachedOdds{
						Price: outcome.Price,
						Point: outcome.Point,
					}

					// Read the last known odds from Redis.
					cached, err := redisClient.GetOdds(ctx,
						game.ID, bookmaker.Key, market.Key, outcome.Name)
					if err != nil {
						// Redis error: log and skip this outcome rather than
						// aborting the whole poll.
						slog.Warn("redis get failed",
							"game_id", game.ID,
							"bookmaker", bookmaker.Key,
							"error", err,
						)
						continue
					}

					// Always write the latest value back to Redis, whether or
					// not it changed, to reset the TTL.
					if err := redisClient.SetOdds(ctx,
						game.ID, bookmaker.Key, market.Key, outcome.Name, newOdds,
					); err != nil {
						slog.Warn("redis set failed", "game_id", game.ID, "error", err)
					}

					// Cache miss means we've never seen this outcome before —
					// record the snapshot but there's no "movement" yet.
					if cached == nil {
						snapshots = append(snapshots, buildSnapshot(game, sport, bookmaker.Key, market.Key, outcome))
						continue
					}

					// Check if the change clears the configured threshold.
					movement := detection.Detect(
						game.ID, bookmaker.Key, market.Key, outcome.Name,
						*cached, newOdds,
						cfg.MovementThresholdSpread,
						cfg.MovementThresholdMoneyline,
					)

					if movement != nil {
						snapshots = append(snapshots, buildSnapshot(game, sport, bookmaker.Key, market.Key, outcome))
						movements = append(movements, *movement)
					}
				}
			}
		}
	}

	return snapshots, movements, nil
}

// buildSnapshot constructs an OddsSnapshot struct from the API response fields.
func buildSnapshot(game models.APIGame, sport, bookmaker, market string, outcome models.APIOutcome) models.OddsSnapshot {
	return models.OddsSnapshot{
		GameID:     game.ID,
		Sport:      sport,
		HomeTeam:   game.HomeTeam,
		AwayTeam:   game.AwayTeam,
		CommenceAt: game.CommenceTime,
		Bookmaker:  bookmaker,
		Market:     market,
		Outcome:    outcome.Name,
		Price:      outcome.Price,
		Point:      outcome.Point,
	}
}

// fetchOdds calls The Odds API and returns the parsed response.
// We request h2h, spreads, and totals in one call to minimise API quota usage.
//
// The commenceTimeFrom/To params filter to games starting on the given date only.
// Without them, The Odds API returns every upcoming game for the sport, which
// burns quota on events we don't care about yet.
func fetchOdds(ctx context.Context, cfg *config.Config, sport string, date time.Time) (models.APIResponse, error) {
	// Build a time window covering all games on the selected date in any US timezone.
	// A strict UTC day (T00:00:00Z to T23:59:59Z) misses evening US games: an 8 PM ET
	// game starts at T00:00:00Z the *next* UTC day, a 10 PM PT game at T06:00:00Z.
	// Extending commenceTimeTo to noon UTC the next day catches everything.
	dateStr := date.UTC().Format("2006-01-02")
	// Start at 08:00 UTC (4 AM ET) rather than midnight so that previous-evening
	// US games (e.g. 10 PM PT = 06:00 UTC) don't bleed into the next date's results.
	// No US sports begin before noon ET (16:00 UTC), so this window misses nothing.
	from := dateStr + "T08:00:00Z"
	nextDay := date.UTC().AddDate(0, 0, 1).Format("2006-01-02")
	to := nextDay + "T12:00:00Z"

	url := fmt.Sprintf(
		"%s/sports/%s/odds?apiKey=%s&regions=us&markets=h2h,spreads,totals&oddsFormat=american&commenceTimeFrom=%s&commenceTimeTo=%s",
		cfg.OddsAPIBase, sport, cfg.OddsAPIKey, from, to,
	)

	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var games models.APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&games); err != nil {
		return nil, fmt.Errorf("decode json: %w", err)
	}

	return games, nil
}

// writeSnapshots batch-inserts changed odds snapshots into Postgres.
func writeSnapshots(ctx context.Context, pool *pgxpool.Pool, snapshots []models.OddsSnapshot) error {
	dbCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	const query = `
		INSERT INTO odds_snapshots
			(game_id, sport, home_team, away_team, commence_at,
			 bookmaker, market, outcome, price, point)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`

	batch := &pgx.Batch{}
	for _, s := range snapshots {
		batch.Queue(query,
			s.GameID, s.Sport, s.HomeTeam, s.AwayTeam, s.CommenceAt,
			s.Bookmaker, s.Market, s.Outcome, s.Price, s.Point,
		)
	}

	br := pool.SendBatch(dbCtx, batch)
	defer br.Close()

	for range batch.Len() {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("insert snapshot: %w", err)
		}
	}
	return nil
}

// writeMovements batch-inserts detected line movements into Postgres.
func writeMovements(ctx context.Context, pool *pgxpool.Pool, movements []models.LineMovement) error {
	dbCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	const query = `
		INSERT INTO line_movements
			(game_id, bookmaker, market, outcome,
			 old_price, new_price, old_point, new_point)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`

	batch := &pgx.Batch{}
	for _, m := range movements {
		batch.Queue(query,
			m.GameID, m.Bookmaker, m.Market, m.Outcome,
			m.OldPrice, m.NewPrice, m.OldPoint, m.NewPoint,
		)
	}

	br := pool.SendBatch(dbCtx, batch)
	defer br.Close()

	for range batch.Len() {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("insert movement: %w", err)
		}
	}
	return nil
}
