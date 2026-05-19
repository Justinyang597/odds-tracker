# Sports Betting Odds Tracker

A real-time odds tracker for NFL, NBA, and MLB across major US sportsbooks. Polls [The Odds API](https://the-odds-api.com) on a configurable interval, detects line movements, and streams them live to the browser.

## Features

- **Live odds table** — best available price highlighted per game, market, and outcome across DraftKings, FanDuel, BetMGM, and BetRivers
- **Line movement detection** — configurable thresholds for spreads and moneylines; movements are written to Postgres and streamed to the browser via SSE the moment they're detected
- **Arbitrage scanner** — flags positive-EV cross-book opportunities inline
- **Odds history chart** — click any game to chart price movement over time per book
- **Book comparison modal** — click any market cell to compare all books side-by-side
- **Bet tracker** — log bets locally and track P&L
- **Price alerts** — set a target price on any outcome; fires a browser notification when hit
- **Odds format switcher** — American, Decimal, or Fractional
- **Date picker** — browse historical snapshots or upcoming games
- **Pause / resume** — stop API polling instantly to conserve quota
- **Dark / light mode**

## Stack

| Layer | Tech |
|---|---|
| Backend | Go 1.23, Gin, pgx v5, go-redis v9 |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, SWR, Recharts |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Data | [The Odds API](https://the-odds-api.com) |
| Infrastructure | Docker Compose |

## Quick Start

**Prerequisites:** Docker Desktop

1. Clone the repo and copy the example env file:
   ```bash
   git clone https://github.com/YOUR_USERNAME/odds-tracker.git
   cd odds-tracker
   cp .env.example .env
   ```

2. Add your Odds API key to `.env`:
   ```
   ODDS_API_KEY=your_key_here
   ```

3. Start everything:
   ```bash
   docker compose up --build
   ```

4. Open [http://localhost:3000](http://localhost:3000)

The backend runs on `:8080` and the frontend on `:3000`. Postgres and Redis are managed internally by Compose and are not exposed beyond those containers.

## Configuration

All config is via environment variables. Copy `.env.example` to `.env` to get started.

| Variable | Default | Description |
|---|---|---|
| `ODDS_API_KEY` | — | **Required.** Your key from [the-odds-api.com](https://the-odds-api.com) |
| `ODDS_API_BASE` | `https://api.the-odds-api.com/v4` | API base URL |
| `DATABASE_URL` | — | **Required.** Postgres connection string |
| `REDIS_URL` | — | **Required.** Redis connection string |
| `POLL_INTERVAL_SECONDS` | `60` | How often to poll each sport |
| `LIVE_POLL_INTERVAL_SECONDS` | `15` | Poll interval once any game in a sport has started |
| `MOVEMENT_THRESHOLD_SPREAD` | `0.5` | Minimum point change to record a spread movement |
| `MOVEMENT_THRESHOLD_MONEYLINE` | `10` | Minimum price change to record a moneyline movement |
| `PORT` | `8080` | Backend HTTP port |

## Architecture

```
The Odds API
     │  (HTTP, per-sport goroutine, every POLL_INTERVAL_SECONDS)
     ▼
 Go Backend
 ┌─────────────────────────────────────────────────┐
 │  Poller goroutines (one per sport)              │
 │    │                                            │
 │    ├─► Redis  ◄── last-known odds cache         │
 │    │     (sub-ms reads avoid Postgres on        │
 │    │      every unchanged outcome)              │
 │    │                                            │
 │    ├─► Postgres  ◄── odds_snapshots             │
 │    │               ◄── line_movements           │
 │    │                                            │
 │    └─► movementCh (buffered chan)               │
 │              │                                  │
 │         SSE Broadcaster                         │
 │              │  (fans out to all clients)       │
 └──────────────┼──────────────────────────────────┘
                │ Server-Sent Events
                ▼
          Next.js Frontend
          (SWR polls REST + EventSource for live feed)
```

**Why Redis in front of Postgres?** The API returns all games on every poll regardless of whether prices changed. Checking the previous price via Redis (sub-millisecond) instead of Postgres avoids N×M queries per poll cycle (games × bookmakers × outcomes × markets).

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/odds?sport=&date=` | Latest snapshot per game/book/market/outcome for a sport on a date |
| `GET` | `/api/odds/:game_id` | Latest odds for one game across all books |
| `GET` | `/api/odds/:game_id/history?market=` | Full price history for a game/market |
| `GET` | `/api/movements` | Recent line movements (all sports) |
| `GET` | `/api/movements/:game_id` | Line movements for one game |
| `GET` | `/api/stream` | SSE stream of live line movements |
| `GET` | `/api/pause` | Current pause state |
| `POST` | `/api/pause` | Toggle polling pause |
| `GET` | `/api/date` | Currently active polling date |
| `POST` | `/api/date` | Set active polling date |

## Tracked Sportsbooks

Only licensed US sportsbooks: **DraftKings**, **FanDuel**, **BetMGM**, **BetRivers**. Offshore/unregulated books (Bovada, BetUS, BetOnline, LowVig, MyBookie) are filtered at the ingestion layer and never written to the database.

## Local Development (without Docker)

Run Postgres and Redis via Docker, then start the services natively:

```bash
# Start only the infrastructure
docker compose up postgres redis

# Backend — from /backend
go run .

# Frontend — from /frontend
npm install
npm run dev
```

Update `.env` to use `localhost` instead of the Compose service names:
```
DATABASE_URL=postgres://oddsuser:oddspass@localhost:5432/oddsdb
REDIS_URL=redis://localhost:6379
```
