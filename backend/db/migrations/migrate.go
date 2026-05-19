// Package migrations provides the schema migration logic.
// The SQL file is embedded at compile time so the binary is self-contained —
// no need to ship the .sql file alongside the binary or run a separate tool.
package migrations

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// statements are executed in order on every startup.
// IF NOT EXISTS makes every statement a safe no-op after the first run.
//
// Why hardcoded strings instead of an embedded SQL file:
// pool.Exec uses the extended query protocol, which silently drops all but the
// first statement in a multi-statement string. Splitting a file by semicolons
// is fragile (inline comments, encoding). Explicit statements are unambiguous.
var statements = []string{
	`CREATE TABLE IF NOT EXISTS odds_snapshots (
		id           SERIAL PRIMARY KEY,
		game_id      TEXT        NOT NULL,
		sport        TEXT        NOT NULL,
		home_team    TEXT        NOT NULL,
		away_team    TEXT        NOT NULL,
		commence_at  TIMESTAMPTZ NOT NULL,
		bookmaker    TEXT        NOT NULL,
		market       TEXT        NOT NULL,
		outcome      TEXT        NOT NULL,
		price        NUMERIC     NOT NULL,
		point        NUMERIC,
		captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`,

	`CREATE INDEX IF NOT EXISTS idx_snapshots_game_id
		ON odds_snapshots(game_id, captured_at DESC)`,

	`CREATE TABLE IF NOT EXISTS line_movements (
		id           SERIAL PRIMARY KEY,
		game_id      TEXT        NOT NULL,
		bookmaker    TEXT        NOT NULL,
		market       TEXT        NOT NULL,
		outcome      TEXT        NOT NULL,
		old_price    NUMERIC     NOT NULL,
		new_price    NUMERIC     NOT NULL,
		old_point    NUMERIC,
		new_point    NUMERIC,
		moved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`,

	`CREATE INDEX IF NOT EXISTS idx_movements_moved_at
		ON line_movements(moved_at DESC)`,

	`CREATE INDEX IF NOT EXISTS idx_movements_game_id
		ON line_movements(game_id, moved_at DESC)`,
}

// Run applies all schema statements against the pool.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("migrations: %w", err)
		}
	}
	return nil
}
