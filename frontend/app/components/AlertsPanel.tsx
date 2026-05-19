"use client";

import { useEffect, useState } from "react";

export interface OddsAlert {
  id: string;
  label: string;
  outcomeSearch: string;
  market: "h2h" | "spreads" | "totals";
  direction: ">=" | "<=";
  targetOdds: number;
  active: boolean;
  lastTriggered?: string;
}

const STORAGE_KEY = "oddstracker_alerts";

export function loadAlerts(): OddsAlert[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: OddsAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

interface Props {
  onClose: () => void;
  sport: string;
}

export default function AlertsPanel({ onClose }: Props) {
  const [alerts, setAlerts] = useState<OddsAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  const [form, setForm] = useState({
    label: "",
    outcomeSearch: "",
    market: "h2h" as OddsAlert["market"],
    direction: ">=" as OddsAlert["direction"],
    targetOdds: "",
  });

  useEffect(() => {
    setAlerts(loadAlerts());
    if (Notification.permission === "denied") setPermDenied(true);
  }, []);

  async function requestPermission() {
    const result = await Notification.requestPermission();
    if (result === "denied") setPermDenied(true);
    return result === "granted";
  }

  async function addAlert() {
    const targetOdds = parseInt(form.targetOdds);
    if (!form.outcomeSearch || isNaN(targetOdds)) return;

    const granted = Notification.permission === "granted" || (await requestPermission());
    if (!granted) return;

    const newAlert: OddsAlert = {
      id: crypto.randomUUID(),
      label: form.label || `${form.outcomeSearch} ${form.market === "h2h" ? "ML" : form.market} ${form.direction} ${form.targetOdds}`,
      outcomeSearch: form.outcomeSearch,
      market: form.market,
      direction: form.direction,
      targetOdds,
      active: true,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveAlerts(updated);
    setForm({ label: "", outcomeSearch: "", market: "h2h", direction: ">=", targetOdds: "" });
    setShowForm(false);
  }

  function toggleAlert(id: string) {
    const updated = alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
    setAlerts(updated);
    saveAlerts(updated);
  }

  function deleteAlert(id: string) {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
  }

  const inputCls = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[420px] h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-900 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Odds Alerts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {permDenied && (
            <div className="mx-4 mt-4 rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-xs text-yellow-700 dark:text-yellow-400">
              Browser notifications are blocked. Enable them in your browser settings to receive alerts.
            </div>
          )}

          <div className="px-4 mt-4">
            {showForm ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">New Alert</p>
                <div>
                  <label className={labelCls}>Label (optional)</label>
                  <input className={inputCls} placeholder="e.g. Lakers +5 or better" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Team or outcome to watch</label>
                  <input className={inputCls} placeholder="e.g. Lakers, Over, Celtics" value={form.outcomeSearch} onChange={(e) => setForm({ ...form, outcomeSearch: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Market</label>
                    <select className={inputCls} value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as OddsAlert["market"] })}>
                      <option value="h2h">Moneyline</option>
                      <option value="spreads">Spread</option>
                      <option value="totals">Total</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Condition</label>
                    <select className={inputCls} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as OddsAlert["direction"] })}>
                      <option value=">=">≥ (at least)</option>
                      <option value="<=">≤ (at most)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Target odds</label>
                    <input className={inputCls} type="number" placeholder="+150" value={form.targetOdds} onChange={(e) => setForm({ ...form, targetOdds: e.target.value })} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-600">
                  Alerts fire as browser notifications when today&apos;s best odds match your condition.
                </p>
                <div className="flex gap-2 pt-1">
                  <button onClick={addAlert} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">Create Alert</button>
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
              >
                + New alert
              </button>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="px-4 mt-4 pb-4 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</p>
              {alerts.map((alert) => (
                <div key={alert.id} className={`rounded-xl border p-3 transition-all ${alert.active ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60" : "border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{alert.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {alert.outcomeSearch} · {alert.market === "h2h" ? "ML" : alert.market} {alert.direction} {alert.targetOdds > 0 ? "+" : ""}{alert.targetOdds}
                      </p>
                      {alert.lastTriggered && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">
                          Last fired: {new Date(alert.lastTriggered).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteAlert(alert.id)} className="text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 text-xs flex-shrink-0">✕</button>
                  </div>
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`mt-2 w-full py-1 rounded-lg text-xs font-semibold border transition-all ${
                      alert.active
                        ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {alert.active ? "Active — click to pause" : "Paused — click to activate"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {alerts.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-3xl mb-3">🔔</p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No alerts set</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Get notified when odds hit your target</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
