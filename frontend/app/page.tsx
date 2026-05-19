"use client";

import { useCallback, useState } from "react";
import OddsTable from "./components/OddsTable";
import OddsChart from "./components/OddsChart";
import Sidebar from "./components/Sidebar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_EXCLUDED = new Set<string>(["betonlineag", "betus", "bovada", "lowvig", "mybookieag"]);

export default function Home() {
  const [sport, setSport] = useState("basketball_nba");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedGameLabel, setSelectedGameLabel] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [excludedBooks, setExcludedBooks] = useState<Set<string>>(DEFAULT_EXCLUDED);
  const [availableBooks, setAvailableBooks] = useState<string[]>([]);

  function handleGameSelect(gameId: string, label: string) {
    setSelectedGameId((prev) => (prev === gameId ? null : gameId));
    setSelectedGameLabel(label);
  }

  const togglePause = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/pause`, { method: "POST" });
      const { paused: next } = await res.json();
      setPaused(next);
    } catch {
      setPaused((p) => !p);
    }
  }, []);

  function toggleBook(key: string) {
    setExcludedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sport={sport}
        setSport={(s) => { setSport(s); setSelectedGameId(null); }}
        paused={paused}
        onTogglePause={togglePause}
        excludedBooks={excludedBooks}
        onToggleBook={toggleBook}
        availableBooks={availableBooks}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <OddsTable
            sport={sport}
            selectedGameId={selectedGameId}
            onGameSelect={handleGameSelect}
            paused={paused}
            activeDate={todayString()}
            excludedBooks={excludedBooks}
            onBooksUpdate={setAvailableBooks}
          />
          {selectedGameId && (
            <div className="mt-5">
              <OddsChart gameId={selectedGameId} gameLabel={selectedGameLabel} paused={paused} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
