// Bookmaker metadata: display name, short abbreviation, logo URL, badge colors.
// Logo URLs use Google's favicon service which returns 64×64 images — no API key needed.

function gfav(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export interface BookmakerInfo {
  name: string;
  short: string;
  logoUrl: string;
  bgColor: string;   // badge background when logo fails
  textColor: string; // badge text when logo fails
}

export const BOOKMAKER_INFO: Record<string, BookmakerInfo> = {
  draftkings:     { name: "DraftKings",    short: "DK",   logoUrl: gfav("draftkings.com"),          bgColor: "#183D2B", textColor: "#4ADE80" },
  fanduel:        { name: "FanDuel",       short: "FD",   logoUrl: gfav("fanduel.com"),             bgColor: "#001540", textColor: "#60A5FA" },
  betmgm:         { name: "BetMGM",        short: "MGM",  logoUrl: gfav("betmgm.com"),              bgColor: "#292400", textColor: "#FCD34D" },
  caesars:        { name: "Caesars",       short: "CZR",  logoUrl: gfav("caesarssportsbook.com"),   bgColor: "#1A0E00", textColor: "#F59E0B" },
  williamhill_us: { name: "Caesars",       short: "CZR",  logoUrl: gfav("caesarssportsbook.com"),   bgColor: "#1A0E00", textColor: "#F59E0B" },
  espnbet:        { name: "ESPN BET",      short: "ESPN", logoUrl: gfav("espnbet.com"),             bgColor: "#3B0000", textColor: "#F87171" },
  fanatics:       { name: "Fanatics",      short: "FAN",  logoUrl: gfav("sportsbook.fanatics.com"), bgColor: "#00153B", textColor: "#93C5FD" },
  betrivers:      { name: "BetRivers",     short: "BR",   logoUrl: gfav("betrivers.com"),           bgColor: "#00153B", textColor: "#6EE7F7" },
  pointsbet:      { name: "PointsBet",     short: "PB",   logoUrl: gfav("pointsbet.com"),           bgColor: "#3B0000", textColor: "#FCA5A5" },
  mybookieag:     { name: "MyBookie",      short: "MB",   logoUrl: gfav("mybookie.ag"),             bgColor: "#1A1A1A", textColor: "#D1D5DB" },
  superbook:      { name: "SuperBook",     short: "SB",   logoUrl: gfav("superbook.com"),           bgColor: "#001A3B", textColor: "#93C5FD" },
  hardrockbet:    { name: "Hard Rock Bet", short: "HR",   logoUrl: gfav("hardrockbet.com"),         bgColor: "#1A0000", textColor: "#FCA5A5" },
  fliff:          { name: "Fliff",         short: "FLF",  logoUrl: gfav("getfliff.com"),            bgColor: "#1A003B", textColor: "#C4B5FD" },
  circasports:    { name: "Circa Sports",  short: "CCA",  logoUrl: gfav("circasports.com"),         bgColor: "#001A3B", textColor: "#60A5FA" },
  unibet_us:      { name: "Unibet",        short: "UNI",  logoUrl: gfav("unibet.com"),              bgColor: "#001A0A", textColor: "#4ADE80" },
  thescorebet:    { name: "theScore Bet",  short: "TSB",  logoUrl: gfav("thescore.bet"),            bgColor: "#1A0000", textColor: "#F87171" },
};

export function getBookmakerInfo(key: string): BookmakerInfo {
  return (
    BOOKMAKER_INFO[key] ?? {
      name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      short: key.slice(0, 3).toUpperCase(),
      logoUrl: "",
      bgColor: "#1F2937",
      textColor: "#9CA3AF",
    }
  );
}
