import { db, withTx, type BetRow, type FixtureRow } from "./db";
import { fetchScores } from "./oddsApi";
import { settleArenaRound } from "./arena";

/** How long after kickoff we consider a match plausibly finished. */
const MATCH_DURATION_MS = 150 * 60_000;
/** Bets whose fixture never got a score within this window are voided (stake refunded). */
const VOID_AFTER_MS = 4 * 24 * 60 * 60_000;

export interface SettleSummary {
  settled: number;
  won: number;
  lost: number;
  voided: number;
  arenasFinalized: number;
  scoresFetchedFor: string[];
}

/**
 * Settle everything in one pass:
 * 1. Career + arena bets already resolvable from cached scores (no API cost).
 * 2. One scores fetch per league that still has pending bets past full time
 *    (2 credits each), then settle again.
 * 3. Finalize arenas whose slate is done — ranks, RP, crowns.
 */
export async function settleEverything(): Promise<SettleSummary> {
  const summary: SettleSummary = {
    settled: 0,
    won: 0,
    lost: 0,
    voided: 0,
    arenasFinalized: 0,
    scoresFetchedFor: [],
  };

  await settleCareerFromDb(summary);

  const pendingSports = (
    await db().many<{ sport_key: string }>(
      `SELECT DISTINCT f.sport_key FROM fixtures f
       WHERE f.completed = 0
         AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) * 1000 > ?
         AND (
           EXISTS (SELECT 1 FROM bets b WHERE b.fixture_id = f.id AND b.status = 'open')
           OR EXISTS (SELECT 1 FROM arena_bets ab WHERE ab.fixture_id = f.id AND ab.status = 'open')
         )`,
      [MATCH_DURATION_MS],
    )
  ).map((r) => r.sport_key);

  for (const sport of pendingSports) {
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
      summary.scoresFetchedFor.push(sport);
    } catch (err) {
      console.error(`[settle] score fetch failed for ${sport}:`, err);
    }
  }

  if (summary.scoresFetchedFor.length > 0) await settleCareerFromDb(summary);
  await voidStaleCareerBets(summary);

  const arena = await settleArenaRound();
  summary.arenasFinalized = arena.finalized.length;

  return summary;
}

async function settleCareerFromDb(summary: SettleSummary) {
  const rows = await db().many<BetRow & { home_score: number; away_score: number }>(
    `SELECT b.*, f.home_score, f.away_score FROM bets b
     JOIN fixtures f ON f.id = b.fixture_id
     WHERE b.status = 'open' AND f.completed = 1
       AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL`,
  );
  if (rows.length === 0) return;

  await withTx(async (tx) => {
    for (const bet of rows) {
      const winner =
        bet.home_score > bet.away_score ? "home" : bet.home_score < bet.away_score ? "away" : "draw";
      if (bet.selection === winner) {
        const payout = Math.round(bet.stake * bet.odds * 100) / 100;
        await tx.exec("UPDATE bets SET status = 'won', payout = ?, settled_at = now() WHERE id = ?", [
          payout,
          bet.id,
        ]);
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [
          payout,
          bet.user_id,
        ]);
        summary.won++;
      } else {
        await tx.exec("UPDATE bets SET status = 'lost', payout = 0, settled_at = now() WHERE id = ?", [
          bet.id,
        ]);
        summary.lost++;
      }
      summary.settled++;
    }
  });
}

async function voidStaleCareerBets(summary: SettleSummary) {
  const rows = await db().many<BetRow>(
    `SELECT b.* FROM bets b
     JOIN fixtures f ON f.id = b.fixture_id
     WHERE b.status = 'open' AND f.completed = 0
       AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) * 1000 > ?`,
    [VOID_AFTER_MS],
  );
  if (rows.length === 0) return;

  await withTx(async (tx) => {
    for (const bet of rows) {
      await tx.exec(
        "UPDATE bets SET status = 'void', payout = stake, settled_at = now() WHERE id = ?",
        [bet.id],
      );
      await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [
        bet.stake,
        bet.user_id,
      ]);
      summary.voided++;
    }
  });
}

export type BetWithFixture = BetRow &
  Pick<
    FixtureRow,
    "home_team" | "away_team" | "commence_time" | "sport_title" | "completed" | "home_score" | "away_score"
  >;

export async function listBets(userId: number): Promise<BetWithFixture[]> {
  return db().many<BetWithFixture>(
    `SELECT b.*, f.home_team, f.away_team, f.commence_time, f.sport_title,
            f.completed, f.home_score, f.away_score
     FROM bets b JOIN fixtures f ON f.id = b.fixture_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC, b.id DESC`,
    [userId],
  );
}
