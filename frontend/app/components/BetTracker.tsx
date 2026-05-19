"use client";

import { useEffect, useState } from "react";
import { useOddsFormat, formatOdds } from "./OddsFormatProvider";

interface Bet {
  id: string;
  createdAt: string;
  gameLabel: string;
  market: "h2h" | "spreads" | "totals";
  outcome: string;
  bookmaker: string;
  odds: number;
  stake: number;
  result: "pending" | "won" | "lost" | "push";
}

const KNOWN_BOOKS = [
  { key: "draftkings", name: "DraftKings" },
  { key: "fanduel", name: "FanDuel" },
  { key: "betmgm", name: "BetMGM" },
  { key: "caesars", name: "Caesars" },
  { key: "espnbet", name: "ESPN BET" },
  { key: "fanatics", name: "Fanatics" },
  { key: "betrivers", name: "BetRivers" },
  { key: "pointsbet", name: "PointsBet" },
  { key: "superbook", name: "SuperBook" },
  { key: "hardrockbet", name: "Hard Rock" },
  { key: "thescore", name: "theScore Bet" },
  { key: "other", name: "Other" },
];

const STORAGE_KEY = "oddstracker_bets";

function loadBets(): Bet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveBets(bets: Bet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

function toDecimal(american: number): number {
  return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
}

function calcProfit(bet: Bet): number {
  if (bet.result === "won") return bet.stake * (toDecimal(bet.odds) - 1);
  if (bet.result === "lost") return -bet.stake;
  return 0;
}

const RESULT_STYLES: Record<Bet["result"], string> = {
  pending: "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400",
  won: "border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
  lost: "border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
  push: "border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
};

interface Props {
  onClose: () => void;
}

export default function BetTracker({ onClose }: Props) {
  const { format } = useOddsFormat();
  const [bets, setBets] = useState<Bet[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    gameLabel: "",
    market: "h2h" as Bet["market"],
    outcome: "",
    bookmaker: "draftkings",
    odds: "",
    stake: "",
  });

  useEffect(() => {
    setBets(loadBets());
  }, []);

  function addBet() {
    const odds = parseInt(form.odds);
    const stake = parseFloat(form.stake);
    if (!form.gameLabel || !form.outcome || isNaN(odds) || isNaN(stake) || stake <= 0) return;

    const newBet: Bet = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      gameLabel: form.gameLabel,
      market: form.market,
      outcome: form.outcome,
      bookmaker: form.bookmaker,
      odds,
      stake,
      result: "pending",
    };

    const updated = [newBet, ...bets];
    setBets(updated);
    saveBets(updated);
    setForm({ gameLabel: "", market: "h2h", outcome: "", bookmaker: "draftkings", odds: "", stake: "" });
    setShowForm(false);
  }

  function setResult(id: string, result: Bet["result"]) {
    const updated = bets.map((b) => (b.id === id ? { ...b, result } : b));
    setBets(updated);
    saveBets(updated);
  }

  function deleteBet(id: string) {
    const updated = bets.filter((b) => b.id !== id);
    setBets(updated);
    saveBets(updated);
  }

  const settled = bets.filter((b) => b.result !== "pending");
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalPnL = settled.reduce((s, b) => s + calcProfit(b), 0);
  const roi = totalStaked > 0 ? (totalPnL / totalStaked) * 100 : 0;

  const inputCls = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[480px] h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-900 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Bet Tracker</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          {settled.length > 0 && (
            <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Staked", value: `$${totalStaked.toFixed(2)}`, color: "text-gray-900 dark:text-white" },
                { label: "P&L", value: `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`, color: totalPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400" },
                { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, color: roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-3 py-3 text-center">
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-1">{label}</p>
                  <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add bet form */}
          <div className="px-4 mt-4">
            {showForm ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">New Bet</p>
                <div>
                  <label className={labelCls}>Game</label>
                  <input className={inputCls} placeholder="e.g. Lakers @ Celtics" value={form.gameLabel} onChange={(e) => setForm({ ...form, gameLabel: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Market</label>
                    <select className={inputCls} value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as Bet["market"] })}>
                      <option value="h2h">Moneyline</option>
                      <option value="spreads">Spread</option>
                      <option value="totals">Total</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Outcome</label>
                    <input className={inputCls} placeholder="Team or Over/Under" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Book</label>
                    <select className={inputCls} value={form.bookmaker} onChange={(e) => setForm({ ...form, bookmaker: e.target.value })}>
                      {KNOWN_BOOKS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Odds (American)</label>
                    <input className={inputCls} type="number" placeholder="-110" value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Stake ($)</label>
                    <input className={inputCls} type="number" placeholder="100" min="0.01" step="0.01" value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={addBet} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">Add Bet</button>
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
              >
                + Add a bet
              </button>
            )}
          </div>

          {/* Bet list */}
          {bets.length > 0 && (
            <div className="px-4 mt-4 pb-4 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">{bets.length} bet{bets.length !== 1 ? "s" : ""}</p>
              {bets.map((bet) => {
                const profit = calcProfit(bet);
                return (
                  <div key={bet.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{bet.gameLabel}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bet.outcome} · {bet.market === "h2h" ? "ML" : bet.market === "spreads" ? "Spread" : "Total"}</p>
                      </div>
                      <button onClick={() => deleteBet(bet.id)} className="text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 text-xs flex-shrink-0">✕</button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-gray-600 dark:text-gray-400">
                        {formatOdds(bet.odds, format)} · ${bet.stake.toFixed(2)}
                      </span>
                      {bet.result !== "pending" && (
                        <span className={`font-mono font-bold ${profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                          {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {(["pending", "won", "lost", "push"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setResult(bet.id, r)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border capitalize transition-all ${
                            bet.result === r
                              ? RESULT_STYLES[r]
                              : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {bets.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No bets logged yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Track your bets and monitor P&L over time</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
