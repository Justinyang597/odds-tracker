// Package detection contains the line movement detection logic.
// The core function is pure: given old and new odds, it returns whether a
// significant movement occurred. No database calls, no Redis, no side effects.
// This isolation makes it trivial to unit test without any infrastructure.
package detection

import (
	"math"

	"odds-tracker/models"
)

// Detect compares cached odds against newly fetched odds and returns a
// LineMovement if the change exceeds the configured threshold, or nil if not.
//
// Why a pure function here:
// Movement detection is business logic — it should be testable in isolation.
// Keeping it free of I/O means tests run instantly with no mocks or DB setup.
func Detect(
	gameID, bookmaker, market, outcome string,
	old models.CachedOdds,
	new models.CachedOdds,
	thresholdSpread float64,
	thresholdMoneyline float64,
) *models.LineMovement {
	if !exceeds(market, old, new, thresholdSpread, thresholdMoneyline) {
		return nil
	}

	return &models.LineMovement{
		GameID:    gameID,
		Bookmaker: bookmaker,
		Market:    market,
		Outcome:   outcome,
		OldPrice:  old.Price,
		NewPrice:  new.Price,
		OldPoint:  old.Point,
		NewPoint:  new.Point,
	}
}

// exceeds returns true if the price or point change clears the threshold
// for the given market type.
func exceeds(market string, old, new models.CachedOdds, thresholdSpread, thresholdMoneyline float64) bool {
	switch market {
	case "h2h":
		// Moneyline: we care about price movement only.
		return math.Abs(new.Price-old.Price) >= thresholdMoneyline

	case "spreads", "totals":
		// For spreads and totals, a point change (e.g. -3 to -3.5) is the
		// primary signal. Price change alone is a secondary signal.
		pointMoved := false
		if old.Point != nil && new.Point != nil {
			pointMoved = math.Abs(*new.Point-*old.Point) >= thresholdSpread
		}
		priceMoved := math.Abs(new.Price-old.Price) >= thresholdMoneyline
		return pointMoved || priceMoved

	default:
		// Unknown market type: treat any price change as significant rather
		// than silently dropping it.
		return new.Price != old.Price
	}
}
