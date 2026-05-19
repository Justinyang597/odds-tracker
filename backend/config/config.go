package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all values loaded from environment variables.
// We load once at startup so every package shares one typed struct
// instead of calling os.Getenv scattered throughout the codebase.
type Config struct {
	DatabaseURL string
	RedisURL    string

	OddsAPIKey  string
	OddsAPIBase string

	// How often the poller goroutines tick, in seconds.
	PollIntervalSeconds int
	// Faster interval used when a game for that sport has already started.
	LivePollIntervalSeconds int

	// Minimum change required before we record a line movement.
	MovementThresholdSpread    float64
	MovementThresholdMoneyline float64

	Port string
}

// Load reads .env (if present) then pulls values from the environment.
// Docker Compose injects env vars directly, so the .env file is only
// used for local development.
func Load() (*Config, error) {
	// godotenv.Load is a no-op if the file doesn't exist, which is fine
	// in Docker where env vars come from the compose env_file directive.
	_ = godotenv.Load()

	cfg := &Config{}

	cfg.DatabaseURL = requireEnv("DATABASE_URL")
	cfg.RedisURL = requireEnv("REDIS_URL")
	cfg.OddsAPIKey = requireEnv("ODDS_API_KEY")
	cfg.OddsAPIBase = requireEnv("ODDS_API_BASE")
	cfg.Port = getEnvOrDefault("PORT", "8080")

	var err error
	cfg.PollIntervalSeconds, err = getEnvInt("POLL_INTERVAL_SECONDS", 60)
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	cfg.LivePollIntervalSeconds, err = getEnvInt("LIVE_POLL_INTERVAL_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	cfg.MovementThresholdSpread, err = getEnvFloat("MOVEMENT_THRESHOLD_SPREAD", 0.5)
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	cfg.MovementThresholdMoneyline, err = getEnvFloat("MOVEMENT_THRESHOLD_MONEYLINE", 10.0)
	if err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	return cfg, nil
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		// Panic at startup rather than silently running with broken config.
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, fmt.Errorf("invalid integer for %s: %w", key, err)
	}
	return n, nil
}

func getEnvFloat(key string, fallback float64) (float64, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid float for %s: %w", key, err)
	}
	return f, nil
}
