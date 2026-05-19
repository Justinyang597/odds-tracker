"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { getTeamLogoUrl } from "../utils/teamLogos";
import BookDetailModal, { type ModalRow } from "./BookDetailModal";
import { useOddsFormat, formatOdds } from "./OddsFormatProvider";
import { loadAlerts, saveAlerts } from "./AlertsPanel";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const MARKETS: { key: "h2h" | "spreads" | "totals"; label: string }[] = [
  { key: "spreads", label: "Spread" },
  { key: "h2h", label: "Moneyline" },
  { key: "totals", label: "Total" },
];

const SHORT_BOOK: Record<string, string> = {
  draftkings: "DK", fanduel: "FD", betmgm: "MGM", caesars: "CZR",
  williamhill_us: "CZR", espnbet: "ESPN", fanatics: "FAN", betrivers: "BR",
  pointsbet: "PB", superbook: "SUP", hardrockbet: "HR", thescore: "TSB",
};

function formatCommence(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` · ${time}`;
}

function toDecimal(american: number) {
  return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
}

function calcArb(p1: number | null, p2: number | null): number | null {
  if (p1 === null || p2 === null) return null;
  const margin = (1 - (1 / toDecimal(p1) + 1 / toDecimal(p2))) * 100;
  return margin > 0 ? margin : null;
}

function TeamLogo({ name, sport }: { name: string; sport: string }) {
  const [imgError, setImgError] = useState(false);
  const url = getTeamLogoUrl(name, sport);
  const initials = name.split(" ").slice(-2).map((w) => w[0]).join("");
  if (!url || imgError) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 flex-shrink-0 select-none">
        {initials}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} width={32} height={32} onError={() => setImgError(true)} className="w-8 h-8 object-contain flex-shrink-0" />
  );
}

interface OddsEntry { price: number; point?: number; }

function BestOddsCell({
  result, market, totalPrefix, movement,
}: {
  result: { entry: OddsEntry; book: string } | null;
  market: "h2h" | "spreads" | "totals";
  totalPrefix?: "O" | "U";
  movement?: number;
}) {
  const { format } = useOddsFormat();
  if (!result) return <span className="text-gray-300 dark:text-gray-700 text-sm">—</span>;
  const { entry, book } = result;
  return (
    <span className="font-mono inline-flex items-center gap-1 flex-wrap">
      <span>
        {market === "spreads" && entry.point != null && (
          <span className="text-gray-500 dark:text-gray-400 text-xs mr-1">
            {entry.point > 0 ? `+${entry.point}` : entry.point}
          </span>
        )}
        {market === "totals" && entry.point != null && totalPrefix && (
          <span className="text-gray-500 dark:text-gray-400 text-xs mr-1">{totalPrefix}{entry.point}</span>
        )}
        <span className={`text-sm font-bold ${entry.price > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
          {formatOdds(entry.price, format)}
        </span>
      </span>
      <span className="inline-flex items-center gap-0.5">
        {movement !== undefined && movement !== 0 && (
          <span className={`text-[10px] font-bold leading-none ${movement > 0 ? "text-green-500" : "text-red-500"}`}>
            {movement > 0 ? "↑" : "↓"}
          </span>
        )}
        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-sans">
          {SHORT_BOOK[book] ?? book.slice(0, 3).toUpperCase()}
        </span>
      </span>
    </span>
  );
}

interface OddsRow {
  game_id: string; home_team: string; away_team: string;
  commence_at: string; bookmaker: string; market: string;
  outcome: string; price: number; point?: number;
}

interface Props {
  sport: string;
  selectedGameId: string | null;
  onGameSelect: (gameId: string, label: string) => void;
  paused: boolean;
  activeDate: string;
  excludedBooks: Set<string>;
  onBooksUpdate?: (books: string[]) => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type PriceKey = string; // `${gameId}|${market}|${outcome}`

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/50">
        <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <table className="w-full">
        <tbody>
          {[0, 1].map((i) => (
            <tr key={i} className={i === 0 ? "border-b border-gray-100 dark:border-gray-800/30" : ""}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="w-28 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </td>
              {[0, 1, 2].map((j) => (
                <td key={j} className="px-4 py-3"><div className="w-14 h-3 bg-gray-100 dark:bg-gray-800 rounded" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OddsTable({ sport, selectedGameId, onGameSelect, paused, activeDate, excludedBooks, onBooksUpdate }: Props) {
  const [detailModal, setDetailModal] = useState<{ gameId: string; market: "h2h" | "spreads" | "totals" } | null>(null);

  const { data, error, isLoading } = useSWR<OddsRow[]>(
    `${API}/api/odds?sport=${sport}&date=${activeDate}`,
    fetcher,
    { refreshInterval: paused ? 0 : 30_000 },
  );

  // Line movement tracking
  const prevPrices = useRef<Map<PriceKey, number>>(new Map());
  const [moves, setMoves] = useState<Map<PriceKey, number>>(new Map());

  useEffect(() => {
    if (!data) return;

    // Build best price per key from raw data
    const currentBest = new Map<PriceKey, number>();
    for (const r of data) {
      if (excludedBooks.has(r.bookmaker)) continue;
      const key: PriceKey = `${r.game_id}|${r.market}|${r.outcome}`;
      const ex = currentBest.get(key);
      if (ex === undefined || r.price > ex) currentBest.set(key, r.price);
    }

    // Detect changes vs previous
    const newMoves = new Map<PriceKey, number>();
    for (const [key, price] of currentBest) {
      const prev = prevPrices.current.get(key);
      if (prev !== undefined && prev !== price) newMoves.set(key, price - prev);
    }
    if (newMoves.size > 0) setMoves(newMoves);
    prevPrices.current = currentBest;

    // Notify parent of books present in this data
    if (onBooksUpdate) {
      const books = [...new Set(data.filter((r) => !excludedBooks.has(r.bookmaker)).map((r) => r.bookmaker))].sort();
      onBooksUpdate(books);
    }

    // Check odds alerts
    try {
      const alerts = loadAlerts();
      let alertsChanged = false;
      const now = Date.now();
      const COOLDOWN_MS = 5 * 60 * 1000;

      for (const alert of alerts) {
        if (!alert.active) continue;
        const lastFired = alert.lastTriggered ? new Date(alert.lastTriggered).getTime() : 0;
        if (now - lastFired < COOLDOWN_MS) continue;

        for (const [key, price] of currentBest) {
          const [, market, outcome] = key.split("|");
          if (market !== alert.market) continue;
          if (!outcome.toLowerCase().includes(alert.outcomeSearch.toLowerCase())) continue;
          const triggered = alert.direction === ">=" ? price >= alert.targetOdds : price <= alert.targetOdds;
          if (triggered && Notification.permission === "granted") {
            new Notification("Odds Alert — Odds Tracker", {
              body: `${outcome}: ${price > 0 ? "+" : ""}${price} (target: ${alert.direction} ${alert.targetOdds})`,
            });
            alert.lastTriggered = new Date().toISOString();
            alertsChanged = true;
            break;
          }
        }
      }
      if (alertsChanged) saveAlerts(alerts);
    } catch { /* ignore notification errors */ }
  }, [data, excludedBooks]);

  // Build lookup tables
  const gameLookup = new Map<string, Map<string, Map<string, Map<string, OddsEntry>>>>();
  const gamesMap = new Map<string, { home: string; away: string; commence: string }>();
  const allBooks = new Set<string>();

  for (const r of data ?? []) {
    if (excludedBooks.has(r.bookmaker)) continue;
    if (!gamesMap.has(r.game_id)) {
      gamesMap.set(r.game_id, { home: r.home_team, away: r.away_team, commence: r.commence_at });
    }
    if (!gameLookup.has(r.game_id)) gameLookup.set(r.game_id, new Map());
    const byBook = gameLookup.get(r.game_id)!;
    if (!byBook.has(r.bookmaker)) byBook.set(r.bookmaker, new Map());
    const byMarket = byBook.get(r.bookmaker)!;
    if (!byMarket.has(r.market)) byMarket.set(r.market, new Map());
    byMarket.get(r.market)!.set(r.outcome, { price: r.price, point: r.point });
    allBooks.add(r.bookmaker);
  }

  const bookmakerList = [...allBooks].sort();
  const getEntry = (gameId: string, book: string, market: string, outcome: string) =>
    gameLookup.get(gameId)?.get(book)?.get(market)?.get(outcome) ?? null;

  function getBest(gameId: string, market: string, outcome: string): { entry: OddsEntry; book: string } | null {
    let best: { entry: OddsEntry; book: string } | null = null;
    for (const book of bookmakerList) {
      const e = getEntry(gameId, book, market, outcome);
      if (e && (best === null || e.price > best.entry.price)) best = { entry: e, book };
    }
    return best;
  }

  // Modal props
  let modalProps: React.ComponentProps<typeof BookDetailModal> | null = null;
  if (detailModal) {
    const game = gamesMap.get(detailModal.gameId);
    if (game) {
      const col1Name = detailModal.market === "totals" ? "Over" : game.away;
      const col2Name = detailModal.market === "totals" ? "Under" : game.home;
      const rows: ModalRow[] = bookmakerList
        .map((book) => ({ bookKey: book, col1: getEntry(detailModal.gameId, book, detailModal.market, col1Name), col2: getEntry(detailModal.gameId, book, detailModal.market, col2Name) }))
        .filter((r) => r.col1 !== null || r.col2 !== null);
      modalProps = { gameLabel: `${game.away} @ ${game.home}`, commence: game.commence, market: detailModal.market, col1Label: col1Name, col2Label: col2Name, rows, onClose: () => setDetailModal(null) };
    }
  }

  function openDetail(e: React.MouseEvent, gameId: string, market: "h2h" | "spreads" | "totals") {
    e.stopPropagation();
    setDetailModal({ gameId, market });
  }

  return (
    <>
      {isLoading && <div className="space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-5 py-4 text-red-500 dark:text-red-400 text-sm">
          Failed to load odds. Check that the backend is running.
        </div>
      )}

      {!isLoading && !error && gamesMap.size === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 px-5 py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No games today</p>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Check back shortly — the poller runs every 60s.</p>
        </div>
      )}

      {!isLoading && !error && gamesMap.size > 0 && (
        <div className="space-y-2.5">
          {[...gamesMap.entries()]
            .sort(([, a], [, b]) => new Date(a.commence).getTime() - new Date(b.commence).getTime())
            .map(([gameId, game]) => {
              const isSelected = selectedGameId === gameId;

              const awaySpread = getBest(gameId, "spreads", game.away);
              const homeSpread = getBest(gameId, "spreads", game.home);
              const awayML    = getBest(gameId, "h2h",     game.away);
              const homeML    = getBest(gameId, "h2h",     game.home);
              const overTotal = getBest(gameId, "totals",  "Over");
              const underTotal= getBest(gameId, "totals",  "Under");

              const arbSpread = calcArb(awaySpread?.entry.price ?? null, homeSpread?.entry.price ?? null);
              const arbML     = calcArb(awayML?.entry.price ?? null,     homeML?.entry.price ?? null);
              const arbTotal  = calcArb(overTotal?.entry.price ?? null,  underTotal?.entry.price ?? null);

              const arbBadges = ([
                { key: "spreads", label: "SPR", margin: arbSpread },
                { key: "h2h",     label: "ML",  margin: arbML },
                { key: "totals",  label: "TOT", margin: arbTotal },
              ] as const).filter((x) => x.margin !== null);

              return (
                <div
                  key={gameId}
                  onClick={() => onGameSelect(gameId, `${game.away} @ ${game.home}`)}
                  className={`rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:border-blue-500/70 dark:bg-blue-950/20 shadow-lg shadow-blue-100 dark:shadow-blue-950/20"
                      : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/60 hover:border-gray-300 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-900"
                  }`}
                >
                  {/* Card header */}
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800/50 flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{formatCommence(game.commence)}</span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {arbBadges.map(({ key, label, margin }) => (
                        <span
                          key={key}
                          title={`${margin!.toFixed(2)}% arbitrage margin — bet both sides for a guaranteed profit`}
                          className="text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700/50 px-1.5 py-0.5 rounded-full cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ARB {margin!.toFixed(1)}% {label}
                        </span>
                      ))}
                      {isSelected && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-full">
                          Chart ↗
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Odds table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800/40 bg-gray-50/80 dark:bg-gray-900/30">
                          <th className="text-left px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-600 w-44">Team</th>
                          {MARKETS.map(({ key, label }) => (
                            <th key={key} className="text-left px-4 py-1.5 text-xs font-semibold text-gray-500 tracking-wide">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { team: game.away, spread: awaySpread, ml: awayML, total: overTotal, totalPrefix: "O" as const },
                          { team: game.home, spread: homeSpread, ml: homeML, total: underTotal, totalPrefix: "U" as const },
                        ]).map(({ team, spread, ml, total, totalPrefix }, i) => (
                          <tr key={team} className={i === 0 ? "border-b border-gray-100 dark:border-gray-800/30" : ""}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <TeamLogo name={team} sport={sport} />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[7rem]">{team}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors" onClick={(e) => openDetail(e, gameId, "spreads")}>
                              <BestOddsCell result={spread} market="spreads" movement={moves.get(`${gameId}|spreads|${team}`)} />
                            </td>
                            <td className="px-4 py-2.5 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors" onClick={(e) => openDetail(e, gameId, "h2h")}>
                              <BestOddsCell result={ml} market="h2h" movement={moves.get(`${gameId}|h2h|${team}`)} />
                            </td>
                            <td className="px-4 py-2.5 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/50 transition-colors" onClick={(e) => openDetail(e, gameId, "totals")}>
                              <BestOddsCell result={total} market="totals" totalPrefix={totalPrefix} movement={moves.get(`${gameId}|totals|${totalPrefix === "O" ? "Over" : "Under"}`)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-700 mt-4">
        Best odds shown · click market to compare all books · click game to chart.{" "}
        {paused ? "Auto-refresh paused." : "Refreshes every 30s."}
      </p>

      {modalProps && <BookDetailModal {...modalProps} />}
    </>
  );
}
