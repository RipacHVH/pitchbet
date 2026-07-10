import { db, getMeta, setMeta, type FixtureRow } from "./db";
import { consensusOdds, fetchLeagueOdds, fetchScores } from "./oddsApi";

/** How long after kickoff we consider a match plausibly finished. */
const MATCH_DURATION_MS = 150 * 60_000;
/** Passive score capture per league at most this often. */
const SCORE_CAPTURE_TTL_MS = 6 * 60 * 60_000;

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

  await captureFinishedScores();

  return refreshed;
}

/**
 * Passively cache final scores for fixtures that have stakes riding on them.
 * The scores endpoint only reaches 3 days back, but settlement is manual and
 * a player may not press "Check results" within that window — without this,
 * a match's score can fall out of reach forever and the bet eventually voids.
 * This only writes fixture scores; bets stay open (and the result-reveal
 * moment stays intact) until someone actually settles.
 */
async function captureFinishedScores(): Promise<void> {
  const now = Date.now();

  const pendingSports = (
    await db().many<{ sport_key: string }>(
      `SELECT DISTINCT f.sport_key FROM fixtures f
       WHERE f.completed = 0
         AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) * 1000 > ?
         AND (
           EXISTS (SELECT 1 FROM bets b WHERE b.fixture_id = f.id AND b.status = 'open')
           OR EXISTS (SELECT 1 FROM arena_bets ab WHERE ab.fixture_id = f.id AND ab.status = 'open')
           OR EXISTS (SELECT 1 FROM duels d WHERE d.fixture_id = f.id AND d.status = 'live')
         )`,
      [MATCH_DURATION_MS],
    )
  ).map((r) => r.sport_key);

  for (const sport of pendingSports) {
    const last = await getMeta(`last_scores_${sport}`);
    if (last && now - Date.parse(last) < SCORE_CAPTURE_TTL_MS) continue;

    const credits = await creditsRemaining();
    if (credits !== null && credits < creditFloor()) break;

    try {
      const scores = await fetchScores(sport, 3);
      for (const s of scores) {
        if (!s.completed || !s.scores) continue;
        const home = s.scores.find((x) => x.name === s.home_team);
        const away = s.scores.find((x) => x.name === s.away_team);
        if (!home || !away) continue;
        await db().exec(
          `UPDATE fixtures SET completed = 1, home_score = ?, away_score = ? WHERE id = ?`,
          [Number(home.score), Number(away.score), s.id],
        );
      }
      await setMeta(`last_scores_${sport}`, new Date().toISOString());
    } catch (err) {
      console.error(`[fixtures] score capture failed for ${sport}:`, err);
    }
  }
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
