"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type OddsFormat = "american" | "decimal" | "fractional";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function formatOdds(price: number, format: OddsFormat): string {
  if (format === "american") return price > 0 ? `+${price}` : `${price}`;
  if (format === "decimal") {
    const d = price > 0 ? price / 100 + 1 : 100 / Math.abs(price) + 1;
    return d.toFixed(2);
  }
  // fractional (UK-style): +150 → 3/2, -110 → 10/11
  if (price > 0) {
    const g = gcd(price, 100);
    return `${price / g}/${100 / g}`;
  } else {
    const g = gcd(100, Math.abs(price));
    return `${100 / g}/${Math.abs(price) / g}`;
  }
}

interface OddsFormatContextType {
  format: OddsFormat;
  setFormat: (f: OddsFormat) => void;
}

const OddsFormatContext = createContext<OddsFormatContextType>({ format: "american", setFormat: () => {} });

export function OddsFormatProvider({ children }: { children: React.ReactNode }) {
  const [format, setFormatState] = useState<OddsFormat>("american");

  useEffect(() => {
    const stored = localStorage.getItem("oddsFormat") as OddsFormat | null;
    if (stored === "american" || stored === "decimal" || stored === "fractional") {
      setFormatState(stored);
    }
  }, []);

  function setFormat(f: OddsFormat) {
    setFormatState(f);
    localStorage.setItem("oddsFormat", f);
  }

  return (
    <OddsFormatContext.Provider value={{ format, setFormat }}>
      {children}
    </OddsFormatContext.Provider>
  );
}

export const useOddsFormat = () => useContext(OddsFormatContext);
