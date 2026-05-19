// Maps The Odds API full team names to ESPN CDN abbreviations.
// Logo URL pattern: https://a.espncdn.com/i/teamlogos/{league}/500/{abbrev}.png
// No API key required — these are publicly accessible.

const MLB: Record<string, string> = {
  "Arizona Diamondbacks": "ari",
  "Atlanta Braves": "atl",
  "Baltimore Orioles": "bal",
  "Boston Red Sox": "bos",
  "Chicago Cubs": "chc",
  "Chicago White Sox": "cws",
  "Cincinnati Reds": "cin",
  "Cleveland Guardians": "cle",
  "Colorado Rockies": "col",
  "Detroit Tigers": "det",
  "Houston Astros": "hou",
  "Kansas City Royals": "kc",
  "Los Angeles Angels": "laa",
  "Los Angeles Dodgers": "lad",
  "Miami Marlins": "mia",
  "Milwaukee Brewers": "mil",
  "Minnesota Twins": "min",
  "New York Mets": "nym",
  "New York Yankees": "nyy",
  "Oakland Athletics": "oak",
  "Athletics": "oak",
  "Philadelphia Phillies": "phi",
  "Pittsburgh Pirates": "pit",
  "San Diego Padres": "sd",
  "San Francisco Giants": "sf",
  "Seattle Mariners": "sea",
  "St. Louis Cardinals": "stl",
  "Tampa Bay Rays": "tb",
  "Texas Rangers": "tex",
  "Toronto Blue Jays": "tor",
  "Washington Nationals": "wsh",
};

const NBA: Record<string, string> = {
  "Atlanta Hawks": "atl",
  "Boston Celtics": "bos",
  "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha",
  "Chicago Bulls": "chi",
  "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal",
  "Denver Nuggets": "den",
  "Detroit Pistons": "det",
  "Golden State Warriors": "gs",
  "Houston Rockets": "hou",
  "Indiana Pacers": "ind",
  "Los Angeles Clippers": "lac",
  "Los Angeles Lakers": "lal",
  "Memphis Grizzlies": "mem",
  "Miami Heat": "mia",
  "Milwaukee Bucks": "mil",
  "Minnesota Timberwolves": "min",
  "New Orleans Pelicans": "no",
  "New York Knicks": "ny",
  "Oklahoma City Thunder": "okc",
  "Orlando Magic": "orl",
  "Philadelphia 76ers": "phi",
  "Phoenix Suns": "phx",
  "Portland Trail Blazers": "por",
  "Sacramento Kings": "sac",
  "San Antonio Spurs": "sa",
  "Toronto Raptors": "tor",
  "Utah Jazz": "utah",
  "Washington Wizards": "wsh",
};

const NFL: Record<string, string> = {
  "Arizona Cardinals": "ari",
  "Atlanta Falcons": "atl",
  "Baltimore Ravens": "bal",
  "Buffalo Bills": "buf",
  "Carolina Panthers": "car",
  "Chicago Bears": "chi",
  "Cincinnati Bengals": "cin",
  "Cleveland Browns": "cle",
  "Dallas Cowboys": "dal",
  "Denver Broncos": "den",
  "Detroit Lions": "det",
  "Green Bay Packers": "gb",
  "Houston Texans": "hou",
  "Indianapolis Colts": "ind",
  "Jacksonville Jaguars": "jax",
  "Kansas City Chiefs": "kc",
  "Las Vegas Raiders": "lv",
  "Los Angeles Chargers": "lac",
  "Los Angeles Rams": "lar",
  "Miami Dolphins": "mia",
  "Minnesota Vikings": "min",
  "New England Patriots": "ne",
  "New Orleans Saints": "no",
  "New York Giants": "nyg",
  "New York Jets": "nyj",
  "Philadelphia Eagles": "phi",
  "Pittsburgh Steelers": "pit",
  "San Francisco 49ers": "sf",
  "Seattle Seahawks": "sea",
  "Tampa Bay Buccaneers": "tb",
  "Tennessee Titans": "ten",
  "Washington Commanders": "wsh",
};

export function getTeamLogoUrl(teamName: string, sport: string): string | null {
  let abbrev: string | undefined;
  let league: string;

  if (sport.includes("mlb")) {
    abbrev = MLB[teamName];
    league = "mlb";
  } else if (sport.includes("nba")) {
    abbrev = NBA[teamName];
    league = "nba";
  } else if (sport.includes("nfl")) {
    abbrev = NFL[teamName];
    league = "nfl";
  } else {
    return null;
  }

  if (!abbrev) return null;
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${abbrev}.png`;
}
