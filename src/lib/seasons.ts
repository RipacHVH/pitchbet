import { db, withTx, type SeasonResultRow, type SeasonRow } from "./db";
import { tierFor } from "./ranks";

const SEASON_LENGTH_MS = 30 * 24 * 60 * 60_000; // monthly

/** Top-3 coin bonus when a season ends — a nice-to-have, not the main reward. */
const PODIUM_BONUS = [2000, 1000, 500];

function seasonName(n: number): string {
  return `Season ${n}`;
}

export async function getOrCreateActiveSeason(): Promise<SeasonRow> {
  const active = await db().one<SeasonRow>("SELECT * FROM seasons WHERE status = 'active' LIMIT 1");
  if (active) return active;

  const count = await db().one<{ n: string }>("SELECT COUNT(*) AS n FROM seasons");
  const n = Number(count?.n ?? 0) + 1;
  const now = new Date();
  const ends = new Date(now.getTime() + SEASON_LENGTH_MS);

  const created = await db().one<SeasonRow>(
    "INSERT INTO seasons (name, starts_at, ends_at) VALUES (?, ?, ?) RETURNING *",
    [seasonName(n), now.toISOString(), ends.toISOString()],
  );
  return created!;
}

/**
 * If the active season's end has passed, archive its final standings to the
 * permanent Hall of Fame, pay podium bonuses, reset everyone's RP to 0, and
 * start the next season. Safe to call on every request — it's a no-op until
 * a season is actually due, and archiving is idempotent (season flips to
 * 'archived' inside the same transaction as the reset, so it can't double-fire).
 */
export async function rotateSeasonIfDue(): Promise<{ rotated: boolean; endedSeasonName?: string }> {
  const active = await db().one<SeasonRow>("SELECT * FROM seasons WHERE status = 'active' LIMIT 1");
  if (!active) {
    await getOrCreateActiveSeason();
    return { rotated: false };
  }
  if (Date.parse(active.ends_at) > Date.now()) return { rotated: false };

  const standings = await db().many<{ id: number; username: string; rp: number }>(
    "SELECT id, username, rp FROM players WHERE token IS NOT NULL OR password_hash IS NOT NULL ORDER BY rp DESC, arena_wins DESC, created_at ASC",
  );

  await withTx(async (tx) => {
    let rank = 0;
    let lastRp = Number.NaN;
    for (let i = 0; i < standings.length; i++) {
      const p = standings[i];
      if (p.rp !== lastRp) {
        rank = i + 1;
        lastRp = p.rp;
      }
      await tx.exec(
        `INSERT INTO season_results (season_id, player_id, username, final_rp, final_rank, tier)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [active.id, p.id, p.username, p.rp, rank, tierFor(p.rp).name],
      );
      if (rank <= 3 && p.rp > 0) {
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [
          PODIUM_BONUS[rank - 1],
          p.id,
        ]);
      }
      if (rank === 1 && p.rp > 0) {
        await tx.exec("UPDATE players SET season_wins = season_wins + 1 WHERE id = ?", [p.id]);
      }
    }

    await tx.exec("UPDATE players SET rp = 0");
    await tx.exec("UPDATE seasons SET status = 'archived' WHERE id = ?", [active.id]);
  });

  await getOrCreateActiveSeason();
  return { rotated: true, endedSeasonName: active.name };
}

export interface HallOfFameSeason {
  id: number;
  name: string;
  endsAt: string;
  top: { username: string; finalRp: number; finalRank: number; tier: string }[];
}

export async function listHallOfFame(limit = 6): Promise<HallOfFameSeason[]> {
  const seasons = await db().many<SeasonRow>(
    "SELECT * FROM seasons WHERE status = 'archived' ORDER BY ends_at DESC LIMIT ?",
    [limit],
  );
  const out: HallOfFameSeason[] = [];
  for (const s of seasons) {
    const top = await db().many<SeasonResultRow>(
      "SELECT * FROM season_results WHERE season_id = ? AND final_rank <= 3 ORDER BY final_rank ASC",
      [s.id],
    );
    out.push({
      id: s.id,
      name: s.name,
      endsAt: s.ends_at,
      top: top.map((t) => ({
        username: t.username,
        finalRp: t.final_rp,
        finalRank: t.final_rank,
        tier: t.tier,
      })),
    });
  }
  return out;
}
