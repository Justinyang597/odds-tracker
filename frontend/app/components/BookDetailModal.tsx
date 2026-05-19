"use client";

import { useEffect, useState } from "react";
import { getBookmakerInfo } from "../utils/bookmakerInfo";
import { useOddsFormat, formatOdds } from "./OddsFormatProvider";

const MARKET_LABELS: Record<string, string> = {
  h2h: "Moneyline",
  spreads: "Spread",
  totals: "Total",
};

export interface ModalRow {
  bookKey: string;
  col1: { price: number; point?: number } | null;
  col2: { price: number; point?: number } | null;
}

interface Props {
  gameLabel: string;
  commence: string;
  market: "h2h" | "spreads" | "totals";
  col1Label: string;
  col2Label: string;
  rows: ModalRow[];
  onClose: () => void;
}

function formatCommence(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` · ${time}`;
}

function BookLogo({ bookKey }: { bookKey: string }) {
  const [error, setError] = useState(false);
  const info = getBookmakerInfo(bookKey);

  if (!info.logoUrl || error) {
    return (
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: info.bgColor, color: info.textColor }}
      >
        {info.short}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={info.logoUrl}
      alt={info.name}
      width={32}
      height={32}
      onError={() => setError(true)}
      className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
      style={{ backgroundColor: info.bgColor }}
    />
  );
}

export default function BookDetailModal({
  gameLabel,
  commence,
  market,
  col1Label,
  col2Label,
  rows,
  onClose,
}: Props) {
  const { format } = useOddsFormat();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const bestCol1 = Math.max(...rows.map((r) => r.col1?.price ?? -Infinity));
  const bestCol2 = Math.max(...rows.map((r) => r.col2?.price ?? -Infinity));

  function renderOdds(
    entry: { price: number; point?: number } | null,
    isBest: boolean,
    totalPrefix?: "O" | "U",
  ) {
    if (!entry) return <span className="text-gray-300 dark:text-gray-700">—</span>;

    const priceColor = isBest
      ? entry.price > 0 ? "text-green-600 dark:text-green-300" : "text-red-500 dark:text-red-300"
      : entry.price > 0 ? "text-green-600/60 dark:text-green-500/70" : "text-red-500/60 dark:text-red-500/70";

    return (
      <span className="font-mono">
        {market === "spreads" && entry.point != null && (
          <span className="text-gray-500 text-xs mr-1.5">
            {entry.point > 0 ? `+${entry.point}` : entry.point}
          </span>
        )}
        {market === "totals" && entry.point != null && totalPrefix && (
          <span className="text-gray-500 text-xs mr-1.5">{totalPrefix}{entry.point}</span>
        )}
        <span className={`text-sm font-bold ${priceColor}`}>{formatOdds(entry.price, format)}</span>
        {isBest && (
          <span className="ml-1.5 text-[10px] font-semibold text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800/40 px-1 py-0.5 rounded">
            best
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{gameLabel}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {MARKET_LABELS[market]} · {formatCommence(commence)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors ml-6 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto max-h-[65vh]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Book</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {col1Label}
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {col2Label}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {rows.map((row) => {
                const isBest1 = row.col1 != null && row.col1.price === bestCol1;
                const isBest2 = row.col2 != null && row.col2.price === bestCol2;
                return (
                  <tr key={row.bookKey} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <BookLogo bookKey={row.bookKey} />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {getBookmakerInfo(row.bookKey).name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {renderOdds(row.col1, isBest1, "O")}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {renderOdds(row.col2, isBest2, "U")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-600">
            "best" = highest price available across all books
          </span>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
