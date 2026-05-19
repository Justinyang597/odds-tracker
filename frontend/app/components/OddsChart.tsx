"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer,
} from "recharts";
import { useTheme } from "./ThemeProvider";
import { useOddsFormat, formatOdds } from "./OddsFormatProvider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const MARKETS = [
  { key: "h2h", label: "Moneyline" },
  { key: "spreads", label: "Spreads" },
  { key: "totals", label: "Totals" },
];

const COLORS = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#fb923c"];

interface HistoryRow {
  bookmaker: string;
  outcome: string;
  price: number;
  point?: number;
  captured_at: string;
}

interface Props {
  gameId: string;
  gameLabel: string;
  paused: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OddsChart({ gameId, gameLabel, paused }: Props) {
  const [market, setMarket] = useState("h2h");
  const { theme } = useTheme();
  const { format } = useOddsFormat();

  const { data, isLoading } = useSWR<HistoryRow[]>(
    `${API}/api/odds/${gameId}/history?market=${market}`,
    fetcher,
    { refreshInterval: paused ? 0 : 60_000 },
  );

  // Build chart series
  const seriesKeys = new Set<string>();
  const byTime = new Map<string, Record<string, string | number>>();
  for (const row of data ?? []) {
    const key = `${row.bookmaker} • ${row.outcome}`;
    seriesKeys.add(key);
    const t = new Date(row.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (!byTime.has(t)) byTime.set(t, { time: t });
    byTime.get(t)![key] = row.price;
  }
  const chartData = [...byTime.values()];
  const series = [...seriesKeys];

  // Opening vs current per outcome (best price at first/last timestamp)
  const openingByOutcome = new Map<string, number>();
  const currentByOutcome = new Map<string, number>();
  if (data && data.length > 0) {
    const sorted = [...data].sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    // opening: best price seen in the earliest timestamp bucket
    const firstTime = sorted[0].captured_at.slice(0, 16);
    for (const row of sorted) {
      if (row.captured_at.slice(0, 16) !== firstTime) break;
      const prev = openingByOutcome.get(row.outcome);
      if (prev === undefined || row.price > prev) openingByOutcome.set(row.outcome, row.price);
    }
    // current: best price seen in the latest timestamp bucket
    const lastTime = sorted[sorted.length - 1].captured_at.slice(0, 16);
    for (const row of sorted) {
      if (row.captured_at.slice(0, 16) !== lastTime) continue;
      const prev = currentByOutcome.get(row.outcome);
      if (prev === undefined || row.price > prev) currentByOutcome.set(row.outcome, row.price);
    }
  }
  const outcomes = [...new Set(data?.map((r) => r.outcome) ?? [])];

  const isDark = theme === "dark";
  const gridColor = isDark ? "#1f2937" : "#e5e7eb";
  const tickColor = isDark ? "#6b7280" : "#9ca3af";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{gameLabel}</h3>
          <p className="text-xs text-gray-500">Price history</p>
        </div>
        <div className="flex gap-1">
          {MARKETS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                market === m.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
      ) : chartData.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
          Not enough history yet — check back after a few polls.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="time" tick={{ fill: tickColor, fontSize: 11 }} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, fontSize: 12, borderRadius: 8 }}
                labelStyle={{ color: tickColor }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: tickColor }} />
              {series.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Opening vs current line movement */}
          {outcomes.length > 0 && openingByOutcome.size > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-2">Line Movement</p>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-gray-500 dark:text-gray-500 font-medium pb-1">Outcome</th>
                    <th className="text-center text-gray-500 dark:text-gray-500 font-medium pb-1">Open</th>
                    <th className="text-center text-gray-500 dark:text-gray-500 font-medium pb-1">Current</th>
                    <th className="text-center text-gray-500 dark:text-gray-500 font-medium pb-1">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {outcomes.map((outcome) => {
                    const open = openingByOutcome.get(outcome);
                    const current = currentByOutcome.get(outcome);
                    if (open === undefined || current === undefined) return null;
                    const delta = current - open;
                    return (
                      <tr key={outcome}>
                        <td className="py-1.5 text-gray-600 dark:text-gray-400 truncate max-w-[8rem] pr-2">{outcome}</td>
                        <td className="py-1.5 text-center font-mono text-gray-500 dark:text-gray-500">{formatOdds(open, format)}</td>
                        <td className={`py-1.5 text-center font-mono font-semibold ${current > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>{formatOdds(current, format)}</td>
                        <td className={`py-1.5 text-center font-mono ${delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : "text-gray-400"}`}>
                          {delta === 0 ? "—" : `${delta > 0 ? "↑" : "↓"}${Math.abs(delta)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
