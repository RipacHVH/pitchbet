import { setMeta } from "./db";

const BASE = "https://api.the-odds-api.com/v4";

export interface ApiOutcome {
  name: string;
  price: number;
}
export interface ApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: {
    key: string;
    markets?: { key: string; outcomes: ApiOutcome[] }[];
  }[];
}
export interface ApiScore {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

function apiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY is not set");
  return key;
}

/** Record remaining quota from response headers so we can enforce a credit floor. */
async function trackQuota(res: Response): Promise<void> {
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining !== null) {
    await setMeta("credits_remaining", remaining);
    await setMeta("credits_checked_at", new Date().toISOString());
  }
}

/** Costs 1 credit (1 market x 1 region). */
export async function fetchLeagueOdds(sportKey: string): Promise<ApiEvent[]> {
  const url = `${BASE}/sports/${sportKey}/odds/?apiKey=${apiKey()}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;
  const res = await fetch(url, { cache: "no-store" });
  await trackQuota(res);
  if (!res.ok) {
    throw new Error(`Odds request failed for ${sportKey}: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

/**
 * Costs 2 credits when daysFrom is set. The Odds API only accepts daysFrom of
 * 1-3; anything else returns 422, so clamp defensively.
 */
export async function fetchScores(sportKey: string, daysFrom = 3): Promise<ApiScore[]> {
  const clamped = Math.min(Math.max(1, Math.round(daysFrom)), 3);
  const url = `${BASE}/sports/${sportKey}/scores/?apiKey=${apiKey()}&daysFrom=${clamped}&dateFormat=iso`;
  const res = await fetch(url, { cache: "no-store" });
  await trackQuota(res);
  if (!res.ok) {
    throw new Error(`Scores request failed for ${sportKey}: ${res.status}`);
  }
  return res.json();
}

/** Median consensus price per 1X2 outcome across all bookmakers. */
export function consensusOdds(event: ApiEvent): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const prices: Record<"home" | "draw" | "away", number[]> = { home: [], draw: [], away: [] };
  for (const bm of event.bookmakers ?? []) {
    const market = bm.markets?.find((m) => m.key === "h2h");
    for (const o of market?.outcomes ?? []) {
      if (o.name === event.home_team) prices.home.push(o.price);
      else if (o.name === event.away_team) prices.away.push(o.price);
      else if (o.name === "Draw") prices.draw.push(o.price);
    }
  }
  return { home: median(prices.home), draw: median(prices.draw), away: median(prices.away) };
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const val = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(val * 100) / 100;
}
