import { db, getMeta, setMeta, type FixtureRow } from "./db";
import { consensusOdds, fetchLeagueOdds } from "./oddsApi";

export function trackedSports(): string[] {
  return (process.env.ODDS_SPORT_KEYS ?? "soccer_fifa_world_cup")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ttlMinutes(): number {
  return Number(process.env.ODDS_REFRESH_TTL_MINUTES ?? 360);
}

function creditFloor(): number {
  return Number(process.env.ODDS_CREDIT_FLOOR ?? 50);
}

export async function creditsRemaining(): Promise<number | null> {
  const v = await getMeta("credits_remaining");
  return v === null ? null : Number(v);
}

/**
 * Refresh odds for any tracked league whose cache is stale. Each league costs
 * 1 credit, so this is TTL-gated and stops entirely below the credit floor.
 * Returns the list of leagues actually refreshed.
 */
export async function refreshStaleFixtures(force = false): Promise<string[]> {
  const refreshed: string[] = [];
  const now = Date.now();

  for (const sport of trackedSports()) {
    const last = await getMeta(`last_refresh_${sport}`);
    const stale = !last || now - Date.parse(last) > ttlMinutes() * 60_000;
    if (!force && !stale) continue;

    const credits = await creditsRemaining();
    if (credits !== null && credits < creditFloor()) break;

    try {
      const events = await fetchLeagueOdds(sport);
      for (const ev of events) {
        const odds = consensusOdds(ev);
        await db().exec(
          `INSERT INTO fixtures (id, sport_key, sport_title, commence_time, home_team, away_team,
                                home_odds, draw_odds, away_odds, odds_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now()::text)
           ON CONFLICT (id) DO UPDATE SET
             commence_time = excluded.commence_time,
             home_odds = excluded.home_odds,
             draw_odds = excluded.draw_odds,
             away_odds = excluded.away_odds,
             odds_updated_at = excluded.odds_updated_at`,
          [
            ev.id,
            ev.sport_key,
            ev.sport_title,
            ev.commence_time,
            ev.home_team,
            ev.away_team,
            odds.home,
            odds.draw,
            odds.away,
          ],
        );
      }
      await setMeta(`last_refresh_${sport}`, new Date().toISOString());
      refreshed.push(sport);
    } catch (err) {
      console.error(`[fixtures] refresh failed for ${sport}:`, err);
    }
  }
  return refreshed;
}

/** Upcoming (not yet kicked off) fixtures with odds, grouped by league. */
export async function upcomingFixtures(): Promise<
  { sportKey: string; sportTitle: string; fixtures: FixtureRow[] }[]
> {
  const rows = await db().many<FixtureRow>(
    `SELECT * FROM fixtures
     WHERE completed = 0 AND commence_time > ?
       AND home_odds IS NOT NULL
     ORDER BY commence_time ASC`,
    [new Date().toISOString()],
  );

  const groups = new Map<string, { sportKey: string; sportTitle: string; fixtures: FixtureRow[] }>();
  for (const row of rows) {
    let g = groups.get(row.sport_key);
    if (!g) {
      g = { sportKey: row.sport_key, sportTitle: row.sport_title, fixtures: [] };
      groups.set(row.sport_key, g);
    }
    g.fixtures.push(row);
  }
  return [...groups.values()];
}
