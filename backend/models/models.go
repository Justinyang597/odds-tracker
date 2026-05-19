package models

import "time"

// OddsSnapshot is one row in odds_snapshots: a point-in-time record of a
// single outcome's price for a specific game/bookmaker/market combination.
type OddsSnapshot struct {
	ID          int64     `db:"id"`
	GameID      string    `db:"game_id"`
	Sport       string    `db:"sport"`
	HomeTeam    string    `db:"home_team"`
	AwayTeam    string    `db:"away_team"`
	CommenceAt  time.Time `db:"commence_at"`
	Bookmaker   string    `db:"bookmaker"`
	Market      string    `db:"market"`   // "spreads" | "h2h" | "totals"
	Outcome     string    `db:"outcome"`  // team name, "Over", or "Under"
	Price       float64   `db:"price"`    // moneyline price (e.g. -110, +150)
	Point       *float64  `db:"point"`    // spread or total line; nil for moneyline
	CapturedAt  time.Time `db:"captured_at"`
}

// LineMovement is one row in line_movements: recorded whenever odds shift
// beyond the configured threshold. These are what get pushed to the frontend.
type LineMovement struct {
	ID        int64     `db:"id"         json:"id"`
	GameID    string    `db:"game_id"    json:"game_id"`
	Bookmaker string    `db:"bookmaker"  json:"bookmaker"`
	Market    string    `db:"market"     json:"market"`
	Outcome   string    `db:"outcome"    json:"outcome"`
	OldPrice  float64   `db:"old_price"  json:"old_price"`
	NewPrice  float64   `db:"new_price"  json:"new_price"`
	OldPoint  *float64  `db:"old_point"  json:"old_point,omitempty"`
	NewPoint  *float64  `db:"new_point"  json:"new_point,omitempty"`
	MovedAt   time.Time `db:"moved_at"   json:"moved_at"`
}

// CachedOdds is what we store in Redis for each outcome.
// It's the "last known state" we diff against on every poll.
type CachedOdds struct {
	Price float64  `json:"price"`
	Point *float64 `json:"point,omitempty"`
}

// --- The Odds API response shapes ---
// These map directly to the JSON returned by https://api.the-odds-api.com/v4/sports/{sport}/odds

// APIResponse is the top-level list returned by The Odds API.
type APIResponse []APIGame

// APIGame is one event (game) in the response.
type APIGame struct {
	ID           string        `json:"id"`
	SportKey     string        `json:"sport_key"`
	HomeTeam     string        `json:"home_team"`
	AwayTeam     string        `json:"away_team"`
	CommenceTime time.Time     `json:"commence_time"`
	Bookmakers   []APIBookmaker `json:"bookmakers"`
}

// APIBookmaker holds one sportsbook's markets for a game.
type APIBookmaker struct {
	Key     string      `json:"key"`
	Markets []APIMarket `json:"markets"`
}

// APIMarket holds one market type (h2h, spreads, totals) and its outcomes.
type APIMarket struct {
	Key      string       `json:"key"`
	Outcomes []APIOutcome `json:"outcomes"`
}

// APIOutcome is a single bet option: a team, Over, or Under with a price/point.
type APIOutcome struct {
	Name  string   `json:"name"`
	Price float64  `json:"price"`
	Point *float64 `json:"point,omitempty"`
}
