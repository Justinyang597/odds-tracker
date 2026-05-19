package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"odds-tracker/models"
)

// TTL is intentionally longer than the poll interval (60s) so a single missed
// poll doesn't cause a false "cache miss = new odds" event.
const TTL = 90 * time.Second

// Client wraps go-redis and exposes only the operations this app needs.
// Keeping the surface area small makes it easy to swap Redis for another
// store in tests without touching business logic.
type Client struct {
	rdb *redis.Client
}

// New parses the Redis URL and pings to confirm connectivity.
func New(ctx context.Context, redisURL string) (*Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("cache: parse url: %w", err)
	}

	rdb := redis.NewClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, fmt.Errorf("cache: ping failed: %w", err)
	}

	return &Client{rdb: rdb}, nil
}

// Close releases the underlying connection.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// oddsKey builds the Redis key for a single outcome.
// Format: odds:{game_id}:{bookmaker}:{market}:{outcome}
func oddsKey(gameID, bookmaker, market, outcome string) string {
	return fmt.Sprintf("odds:%s:%s:%s:%s", gameID, bookmaker, market, outcome)
}

// GetOdds fetches the last-known odds for an outcome.
// Returns (nil, nil) on a cache miss — the caller treats that as "no prior value".
func (c *Client) GetOdds(ctx context.Context, gameID, bookmaker, market, outcome string) (*models.CachedOdds, error) {
	key := oddsKey(gameID, bookmaker, market, outcome)

	val, err := c.rdb.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		// Cache miss: no prior value recorded for this key.
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cache: get %s: %w", key, err)
	}

	var odds models.CachedOdds
	if err := json.Unmarshal([]byte(val), &odds); err != nil {
		return nil, fmt.Errorf("cache: unmarshal %s: %w", key, err)
	}

	return &odds, nil
}

// SetOdds writes the latest odds for an outcome with a 90-second TTL.
// Called after every successful poll, win or lose on detection.
func (c *Client) SetOdds(ctx context.Context, gameID, bookmaker, market, outcome string, odds models.CachedOdds) error {
	key := oddsKey(gameID, bookmaker, market, outcome)

	data, err := json.Marshal(odds)
	if err != nil {
		return fmt.Errorf("cache: marshal %s: %w", key, err)
	}

	if err := c.rdb.Set(ctx, key, data, TTL).Err(); err != nil {
		return fmt.Errorf("cache: set %s: %w", key, err)
	}

	return nil
}
