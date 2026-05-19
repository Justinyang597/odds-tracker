-- Raw odds snapshots per game/book/market.
-- We only INSERT here — we never UPDATE. Every new poll that detects a change
-- writes a fresh row, giving us a full history of how odds have moved.
CREATE TABLE IF NOT EXISTS odds_snapshots (
    id           SERIAL PRIMARY KEY,
    game_id      TEXT        NOT NULL,
    sport        TEXT        NOT NULL,
    home_team    TEXT        NOT NULL,
    away_team    TEXT        NOT NULL,
    commence_at  TIMESTAMPTZ NOT NULL,
    bookmaker    TEXT        NOT NULL,
    market       TEXT        NOT NULL,       -- spreads | h2h | totals
    outcome      TEXT        NOT NULL,       -- team name or Over/Under
    price        NUMERIC     NOT NULL,       -- moneyline price (-110, +150, etc.)
    point        NUMERIC,                    -- spread or total line; NULL for h2h
    captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the most common query: "give me all snapshots for this game"
-- used by the OddsChart to plot historical movement.
CREATE INDEX IF NOT EXISTS idx_snapshots_game_id ON odds_snapshots(game_id, captured_at DESC);

-- Detected line movements — written whenever a price/point shifts beyond threshold.
-- These are the events that get pushed over SSE to the frontend.
CREATE TABLE IF NOT EXISTS line_movements (
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
);

-- Index for the most common query: recent movements across all games,
-- and movements filtered to one game for the detail view.
CREATE INDEX IF NOT EXISTS idx_movements_moved_at  ON line_movements(moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_game_id   ON line_movements(game_id, moved_at DESC);
