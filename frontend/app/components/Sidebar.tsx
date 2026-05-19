"use client";

import { useState } from "react";
import { useTheme } from "./ThemeProvider";
import { useOddsFormat, type OddsFormat } from "./OddsFormatProvider";
import BetTracker from "./BetTracker";
import AlertsPanel from "./AlertsPanel";

const SPORTS = [
  { key: "americanfootball_nfl", label: "NFL", icon: "🏈" },
  { key: "basketball_nba", label: "NBA", icon: "🏀" },
  { key: "baseball_mlb", label: "MLB", icon: "⚾" },
];

const BOOK_DISPLAY_NAMES: Record<string, string> = {
  draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM",
  caesars: "Caesars", williamhill_us: "Caesars", espnbet: "ESPN BET",
  fanatics: "Fanatics", betrivers: "BetRivers", pointsbet: "PointsBet",
  superbook: "SuperBook", hardrockbet: "Hard Rock", thescore: "theScore Bet",
};

const FORMAT_OPTIONS: { key: OddsFormat; label: string; example: string }[] = [
  { key: "american", label: "American", example: "+150" },
  { key: "decimal", label: "Decimal", example: "2.50" },
  { key: "fractional", label: "Fractional", example: "3/2" },
];

interface Props {
  sport: string;
  setSport: (sport: string) => void;
  paused: boolean;
  onTogglePause: () => void;
  excludedBooks: Set<string>;
  onToggleBook: (key: string) => void;
  availableBooks: string[];
}

export default function Sidebar({ sport, setSport, paused, onTogglePause, excludedBooks, onToggleBook, availableBooks }: Props) {
  const { theme, toggle } = useTheme();
  const { format, setFormat } = useOddsFormat();
  const [booksExpanded, setBooksExpanded] = useState(false);
  const [betTrackerOpen, setBetTrackerOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const includedCount = availableBooks.filter((k) => !excludedBooks.has(k)).length;

  return (
    <>
      <aside className="w-64 h-screen sticky top-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
        {/* Branding */}
        <div className="px-4 py-5 flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-900">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white select-none flex-shrink-0">
            OT
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">Odds Tracker</span>
        </div>

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">

          {/* Sport */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2 px-1">Sport</p>
            <div className="space-y-0.5">
              {SPORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSport(s.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2.5 ${
                    sport === s.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="text-base leading-none">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Odds format */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2 px-1">Odds Format</p>
            <div className="space-y-0.5">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                    format === f.key
                      ? "bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 font-semibold"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`font-mono text-xs ${format === f.key ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"}`}>{f.example}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bookmaker filter */}
          <div>
            <button
              onClick={() => setBooksExpanded(!booksExpanded)}
              className="w-full flex items-center justify-between px-1 mb-2"
            >
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                Books{availableBooks.length > 0 && <span className="normal-case font-normal"> ({includedCount}/{availableBooks.length})</span>}
              </p>
              <span className="text-gray-400 dark:text-gray-600 text-[10px]">{booksExpanded ? "▲" : "▼"}</span>
            </button>
            {booksExpanded && (
              <div className="space-y-0.5">
                {availableBooks.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 px-3 py-1">No data loaded yet</p>
                ) : availableBooks.map((key) => {
                  const included = !excludedBooks.has(key);
                  const name = BOOK_DISPLAY_NAMES[key] ?? key;
                  return (
                    <button
                      key={key}
                      onClick={() => onToggleBook(key)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/70"
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 text-[10px] transition-all ${
                        included
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {included && "✓"}
                      </span>
                      <span className={included ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-600"}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Updates */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2 px-1">Updates</p>
            <button
              onClick={onTogglePause}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                paused
                  ? "border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>

          {/* Tools */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2 px-1">Tools</p>
            <div className="space-y-0.5">
              <button
                onClick={() => setBetTrackerOpen(true)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white transition-all flex items-center gap-2.5"
              >
                <span className="text-base leading-none">💰</span>
                Bet Tracker
              </button>
              <button
                onClick={() => setAlertsOpen(true)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white transition-all flex items-center gap-2.5"
              >
                <span className="text-base leading-none">🔔</span>
                Alerts
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-900 space-y-2">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all border border-gray-200 dark:border-gray-700"
          >
            <span className="text-base leading-none">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center">
            {paused ? "Updates paused" : "Live · 30s refresh"}
          </p>
        </div>
      </aside>

      {betTrackerOpen && <BetTracker onClose={() => setBetTrackerOpen(false)} />}
      {alertsOpen && <AlertsPanel onClose={() => setAlertsOpen(false)} sport={sport} />}
    </>
  );
}
