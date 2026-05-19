"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Movement {
  game_id: string;
  bookmaker: string;
  market: string;
  outcome: string;
  old_price: number;
  new_price: number;
  old_point?: number;
  new_point?: number;
  moved_at: string;
  _id?: number;
}

let clientId = 0;

const BOOKMAKER_NAMES: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  williamhill_us: "Caesars",
  espnbet: "ESPN BET",
  fanatics: "Fanatics",
  betrivers: "BetRivers",
  pointsbet: "PointsBet",
  mybookieag: "MyBookie",
  superbook: "SuperBook",
  hardrockbet: "Hard Rock Bet",
  thescorebet: "theScore Bet",
};

function formatBookmaker(key: string): string {
  return (
    BOOKMAKER_NAMES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatPrice(p: number) {
  return p > 0 ? `+${p}` : `${p}`;
}

// Market badge with distinct colors per type
const MARKET_STYLE: Record<string, string> = {
  h2h: "bg-purple-900/60 text-purple-300 border-purple-800/50",
  spreads: "bg-blue-900/60 text-blue-300 border-blue-800/50",
  totals: "bg-amber-900/60 text-amber-300 border-amber-800/50",
};
const MARKET_LABEL: Record<string, string> = {
  h2h: "ML",
  spreads: "SPR",
  totals: "TOT",
};

function MarketBadge({ market }: { market: string }) {
  const style = MARKET_STYLE[market] ?? "bg-gray-700 text-gray-300 border-gray-600";
  return (
    <span
      className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${style}`}
    >
      {MARKET_LABEL[market] ?? market.toUpperCase()}
    </span>
  );
}

export default function MovementFeed() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // EventSource is the native browser SSE API — no library needed.
    // It automatically reconnects on drop, which is one of its advantages
    // over raw WebSockets for a read-only feed like this.
    const es = new EventSource(`${API}/api/stream`);
    esRef.current = es;

    es.onopen = () => setStatus("connected");
    es.onmessage = (event) => {
      try {
        const m: Movement = JSON.parse(event.data);
        m._id = ++clientId;
        setMovements((prev) => [m, ...prev].slice(0, 100));
      } catch {
        // Malformed event — ignore
      }
    };
    es.onerror = () => setStatus("disconnected");

    return () => {
      es.close();
      setStatus("disconnected");
    };
  }, []);

  const statusConfig = {
    connected: { dot: "bg-green-400 animate-pulse", text: "text-green-400", label: "Live" },
    connecting: { dot: "bg-yellow-500", text: "text-yellow-500", label: "Connecting" },
    disconnected: { dot: "bg-gray-600", text: "text-gray-500", label: "Disconnected" },
  }[status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-white">Live Movements</h2>
        <div className={`flex items-center gap-1.5 text-xs ${statusConfig.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mb-3">
              <span className="text-gray-600 text-sm">↕</span>
            </div>
            <p className="text-gray-500 text-sm font-medium">No movements yet</p>
            <p className="text-gray-700 text-xs mt-1">
              Line changes will appear here in real time
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/50">
            {movements.map((m) => {
              const priceUp = m.new_price > m.old_price;
              const pointChanged =
                m.new_point != null &&
                m.old_point != null &&
                m.new_point !== m.old_point;

              return (
                <li
                  key={m._id}
                  className="px-4 py-3 hover:bg-gray-800/30 transition-colors"
                >
                  {/* Top row: badges + time */}
                  <div className="flex items-center gap-2 mb-2">
                    <MarketBadge market={m.market} />
                    <span className="text-gray-300 text-xs font-medium truncate">
                      {formatBookmaker(m.bookmaker)}
                    </span>
                    <span className="text-gray-600 text-xs ml-auto flex-shrink-0">
                      {new Date(m.moved_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Outcome name */}
                  <div className="text-gray-400 text-xs mb-2 truncate">{m.outcome}</div>

                  {/* Price change */}
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-gray-500 text-xs">{formatPrice(m.old_price)}</span>
                    <span className={`text-xs ${priceUp ? "text-green-500" : "text-red-500"}`}>
                      {priceUp ? "↑" : "↓"}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        priceUp ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatPrice(m.new_price)}
                    </span>
                    {pointChanged && (
                      <span className="text-gray-600 text-xs ml-1">
                        ({m.old_point! > 0 ? "+" : ""}{m.old_point} → {m.new_point! > 0 ? "+" : ""}{m.new_point})
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
