import { db, withTx, type DuelRow, type FixtureRow, type Queryable } from "./db";

/** Duels whose fixture never got a score within this window are voided (both refunded). */
const VOID_AFTER_MS = 4 * 24 * 60 * 60_000;
/** Don't serve a clash that kicks off sooner than this — both players need time to pick. */
const MIN_LEAD_MS = 10 * 60_000;
/** Prefer the biggest clash among games kicking off within this window. */
const BIG_GAME_WINDOW_MS = 48 * 60 * 60_000;

/**
 * Ranked divisions. Entry is escrowed coins (winner takes the pot); minRp
 * gates entry by career rank; rpWin/rpLoss is the ladder swing on a decided
 * duel. Names and thresholds mirror the career TIERS in ranks.ts.
 */
export interface DuelDivision {
  id: string;
  name: string;
  emoji: string;
  entry: number;
  minRp: number;
  rpWin: number;
  rpLoss: number;
}

export const DIVISIONS: DuelDivision[] = [
  { id: "sunday", name: "Sunday League", emoji: "🥾", entry: 100, minRp: 0, rpWin: 20, rpLoss: 10 },
  { id: "pub", name: "Pub Team", emoji: "🍺", entry: 250, minRp: 75, rpWin: 35, rpLoss: 20 },
  { id: "semipro", name: "Semi-Pro", emoji: "🏃", entry: 500, minRp: 200, rpWin: 50, rpLoss: 30 },
  { id: "firstteam", name: "First Team", emoji: "⭐", entry: 1000, minRp: 400, rpWin: 70, rpLoss: 45 },
  { id: "legend", name: "Club Legend", emoji: "🏆", entry: 2500, minRp: 750, rpWin: 100, rpLoss: 65 },
  { id: "ballondor", name: "Ballon d'Or", emoji: "👑", entry: 5000, minRp: 1200, rpWin: 150, rpLoss: 100 },
];

export function divisionById(id: string): DuelDivision | undefined {
  return DIVISIONS.find((d) => d.id === id);
}

export type DuelPhase =
  | "searching" // waiting for an opponent
  | "picking" // matched, my sealed call not yet locked
  | "waiting" // my call locked, opponent still picking
  | "locked" // both sealed — revealed, waiting on the final whistle
  | "completed"
  | "void";

export interface DuelOpponent {
  id: number;
  username: string;
  avatar: string | null;
  duelWins: number;
}

export interface DuelView {
  id: number;
  phase: DuelPhase;
  division: DuelDivision;
  stake: number;
  pot: number;
  fixture: FixtureRow | null;
  opponent: DuelOpponent | null;
  myPick: { selection: string; homeGoals: number; awayGoals: number } | null;
  /** Opponent's pick — only exposed once both are sealed (or the duel is decided). */
  theirPick: { selection: string; homeGoals: number; awayGoals: number } | null;
  opponentLocked: boolean;
  result: "won" | "lost" | "split" | null;
  resolvedAt: string | null;
}

interface DuelJoinedRow extends DuelRow {
  opp_username: string | null;
  opp_avatar: string | null;
  opp_duel_wins: number | null;
}

/**
 * The next big clash: the tightest-odds (most evenly matched) game among
 * fixtures kicking off in the next 48 hours — "next" matters as much as
 * "big", so a coin-flip clash a week away never outranks tonight's game.
 * If nothing kicks off inside the window, fall back to the soonest fixture.
 */
async function nextBigGame(tx: Queryable): Promise<FixtureRow | undefined> {
  const from = new Date(Date.now() + MIN_LEAD_MS).toISOString();
  const inWindow = await tx.one<FixtureRow>(
    `SELECT * FROM fixtures
     WHERE completed = 0 AND commence_time > ? AND commence_time < ?
       AND home_odds IS NOT NULL AND away_odds IS NOT NULL
     ORDER BY ABS(home_odds - away_odds) ASC, commence_time ASC
     LIMIT 1`,
    [from, new Date(Date.now() + BIG_GAME_WINDOW_MS).toISOString()],
  );
  if (inWindow) return inWindow;
  return tx.one<FixtureRow>(
    `SELECT * FROM fixtures
     WHERE completed = 0 AND commence_time > ? AND home_odds IS NOT NULL AND away_odds IS NOT NULL
     ORDER BY commence_time ASC
     LIMIT 1`,
    [from],
  );
}

/** The player's duel that is still in motion, newest first. */
async function activeDuel(playerId: number, tx?: Queryable): Promise<DuelRow | undefined> {
  return (tx ?? db()).one<DuelRow>(
    `SELECT * FROM duels
     WHERE (p1_id = ? OR p2_id = ?) AND status IN ('searching','live')
     ORDER BY created_at DESC LIMIT 1`,
    [playerId, playerId],
  );
}

/**
 * Ready up in a division: escrow the entry fee, then either join the oldest
 * searching duel in that division (FIFO) or open a new one and wait.
 * Matching and escrow are one transaction, so two players can't grab the
 * same slot.
 */
export async function readyUp(
  playerId: number,
  divisionId: string,
): Promise<{ error?: string; status?: number }> {
  const division = divisionById(divisionId);
  if (!division) return { error: "No such division.", status: 400 };

  return withTx(async (tx) => {
    const existing = await activeDuel(playerId, tx);
    if (existing) return {}; // already queued or in a duel — the GET shows it

    const player = await tx.one<{ rp: number }>("SELECT rp FROM players WHERE id = ?", [playerId]);
    if ((player?.rp ?? 0) < division.minRp) {
      return {
        error: `${division.name} needs ${division.minRp} RP — climb the ladder first.`,
        status: 403,
      };
    }

    const debit = await tx.exec(
      "UPDATE players SET balance = balance - ? WHERE id = ? AND balance >= ?",
      [division.entry, playerId, division.entry],
    );
    if (debit.rowCount === 0) {
      return { error: `You need ${division.entry} coins to enter ${division.name}.`, status: 409 };
    }

    // FOR UPDATE SKIP LOCKED: concurrent ready-ups each claim a different row.
    const open = await tx.one<DuelRow>(
      `SELECT * FROM duels WHERE status = 'searching' AND tier = ? AND p1_id != ?
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [division.id, playerId],
    );

    const fixture = open ? await nextBigGame(tx) : undefined;

    if (!open || !fixture) {
      // Nobody to fight (or no servable match yet): queue up and wait.
      await tx.exec(
        "INSERT INTO duels (status, tier, stake, p1_id) VALUES ('searching', ?, ?, ?)",
        [division.id, division.entry, playerId],
      );
      return {};
    }

    await tx.exec(
      `UPDATE duels SET status = 'live', p2_id = ?, fixture_id = ?, matched_at = now() WHERE id = ?`,
      [playerId, fixture.id, open.id],
    );
    return {};
  });
}

/** Leave the queue (only while still unmatched) and take the entry back. */
export async function cancelSearch(playerId: number): Promise<{ error?: string; status?: number }> {
  return withTx(async (tx) => {
    const gone = await tx.one<{ stake: number }>(
      `DELETE FROM duels WHERE p1_id = ? AND status = 'searching' RETURNING stake`,
      [playerId],
    );
    if (!gone) {
      return { error: "No open search to cancel — you may already be matched.", status: 409 };
    }
    await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [gone.stake, playerId]);
    return {};
  });
}

/** Seal a call: 1/X/2 plus an exact scoreline. One shot, no edits. */
export async function submitPick(
  playerId: number,
  selection: string,
  homeGoals: number,
  awayGoals: number,
): Promise<{ error?: string; status?: number }> {
  if (!["home", "draw", "away"].includes(selection)) {
    return { error: "Pick home, draw or away.", status: 400 };
  }
  const validGoals = (n: number) => Number.isInteger(n) && n >= 0 && n <= 9;
  if (!validGoals(homeGoals) || !validGoals(awayGoals)) {
    return { error: "Scoreline goals must be whole numbers from 0 to 9.", status: 400 };
  }
  // The scoreline must agree with the call — a 2-1 "draw" makes no sense.
  const impliedWinner = homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw";
  if (impliedWinner !== selection) {
    return { error: "Your scoreline doesn't match your call — adjust one of them.", status: 400 };
  }

  return withTx(async (tx) => {
    const duel = await activeDuel(playerId, tx);
    if (!duel || duel.status !== "live" || !duel.fixture_id) {
      return { error: "No live duel to pick in.", status: 409 };
    }

    const fixture = await tx.one<FixtureRow>("SELECT * FROM fixtures WHERE id = ?", [
      duel.fixture_id,
    ]);
    if (!fixture || Date.parse(fixture.commence_time) <= Date.now()) {
      return { error: "Too late — the match has kicked off.", status: 409 };
    }

    const mine = duel.p1_id === playerId ? "p1" : "p2";
    if ((mine === "p1" ? duel.p1_selection : duel.p2_selection) !== null) {
      return { error: "Your call is already sealed.", status: 409 };
    }

    await tx.exec(
      `UPDATE duels SET ${mine}_selection = ?, ${mine}_home_goals = ?, ${mine}_away_goals = ? WHERE id = ?`,
      [selection, homeGoals, awayGoals, duel.id],
    );
    return {};
  });
}

/** The player's current (or most recently finished) duel, shaped for the UI. */
export async function getMyDuel(playerId: number): Promise<DuelView | null> {
  const row = await db().one<DuelJoinedRow>(
    `SELECT d.*, p.username AS opp_username, p.avatar AS opp_avatar, p.duel_wins AS opp_duel_wins
     FROM duels d
     LEFT JOIN players p ON p.id = CASE WHEN d.p1_id = ? THEN d.p2_id ELSE d.p1_id END
     WHERE d.p1_id = ? OR d.p2_id = ?
     ORDER BY (d.status IN ('searching','live')) DESC, d.created_at DESC
     LIMIT 1`,
    [playerId, playerId, playerId],
  );
  if (!row) return null;

  const iAmP1 = row.p1_id === playerId;
  const my = iAmP1
    ? { selection: row.p1_selection, hg: row.p1_home_goals, ag: row.p1_away_goals }
    : { selection: row.p2_selection, hg: row.p2_home_goals, ag: row.p2_away_goals };
  const theirs = iAmP1
    ? { selection: row.p2_selection, hg: row.p2_home_goals, ag: row.p2_away_goals }
    : { selection: row.p1_selection, hg: row.p1_home_goals, ag: row.p1_away_goals };

  const bothSealed = my.selection !== null && theirs.selection !== null;

  let phase: DuelPhase;
  if (row.status === "searching") phase = "searching";
  else if (row.status === "void") phase = "void";
  else if (row.status === "completed") phase = "completed";
  else if (my.selection === null) phase = "picking";
  else if (theirs.selection === null) phase = "waiting";
  else phase = "locked";

  const fixture = row.fixture_id
    ? await db().one<FixtureRow>("SELECT * FROM fixtures WHERE id = ?", [row.fixture_id])
    : undefined;

  const opponent: DuelOpponent | null =
    row.p2_id !== null && row.opp_username
      ? {
          id: iAmP1 ? row.p2_id : row.p1_id,
          username: row.opp_username,
          avatar: row.opp_avatar,
          duelWins: row.opp_duel_wins ?? 0,
        }
      : null;

  const result =
    row.status !== "completed"
      ? null
      : row.winner_id === null
        ? ("split" as const)
        : row.winner_id === playerId
          ? ("won" as const)
          : ("lost" as const);

  return {
    id: row.id,
    phase,
    division: divisionById(row.tier) ?? DIVISIONS[0],
    stake: row.stake,
    pot: row.stake * 2,
    fixture: fixture ?? null,
    opponent,
    myPick:
      my.selection !== null
        ? { selection: my.selection, homeGoals: my.hg!, awayGoals: my.ag! }
        : null,
    theirPick:
      bothSealed || row.status === "completed"
        ? theirs.selection !== null
          ? { selection: theirs.selection, homeGoals: theirs.hg!, awayGoals: theirs.ag! }
          : null
        : null,
    opponentLocked: theirs.selection !== null,
    result,
    resolvedAt: row.resolved_at,
  };
}

/** Goal distance between a predicted and the real scoreline — the tiebreak. */
function scoreDistance(ph: number, pa: number, h: number, a: number): number {
  return Math.abs(ph - h) + Math.abs(pa - a);
}

/**
 * Resolve every duel whose match has finished (call/scoreline rules), and
 * void-refund duels whose fixture will never get a score. Runs inside the
 * global settle pass.
 */
export async function resolveDuels(): Promise<number> {
  const due = await db().many<DuelRow & { home_score: number; away_score: number }>(
    `SELECT d.*, f.home_score, f.away_score FROM duels d
     JOIN fixtures f ON f.id = d.fixture_id
     WHERE d.status = 'live' AND f.completed = 1
       AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL`,
  );

  let resolved = 0;
  for (const duel of due) {
    await withTx(async (tx) => {
      const winner = duel.home_score > duel.away_score ? "home" : duel.home_score < duel.away_score ? "away" : "draw";
      const p1Right = duel.p1_selection === winner;
      const p2Right = duel.p2_selection === winner;

      let winnerId: number | null;
      if (duel.p1_selection === null && duel.p2_selection === null) {
        // Nobody showed up — hand the antes back.
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p1_id]);
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p2_id]);
        await tx.exec("UPDATE duels SET status = 'void', resolved_at = now() WHERE id = ?", [duel.id]);
        return;
      } else if (duel.p1_selection === null) {
        winnerId = duel.p2_id; // forfeits go to whoever sealed a call
      } else if (duel.p2_selection === null) {
        winnerId = duel.p1_id;
      } else if (p1Right !== p2Right) {
        winnerId = p1Right ? duel.p1_id : duel.p2_id;
      } else {
        // Both right or both wrong — closest scoreline takes it.
        const d1 = scoreDistance(duel.p1_home_goals!, duel.p1_away_goals!, duel.home_score, duel.away_score);
        const d2 = scoreDistance(duel.p2_home_goals!, duel.p2_away_goals!, duel.home_score, duel.away_score);
        winnerId = d1 === d2 ? null : d1 < d2 ? duel.p1_id : duel.p2_id;
      }

      if (winnerId === null) {
        // Dead heat — pot splits back to both, ladder untouched.
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p1_id]);
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p2_id]);
      } else {
        const division = divisionById(duel.tier) ?? DIVISIONS[0];
        const loserId = winnerId === duel.p1_id ? duel.p2_id : duel.p1_id;
        await tx.exec(
          "UPDATE players SET balance = balance + ?, duel_wins = duel_wins + 1, rp = rp + ? WHERE id = ?",
          [duel.stake * 2, division.rpWin, winnerId],
        );
        await tx.exec("UPDATE players SET rp = GREATEST(0, rp - ?) WHERE id = ?", [
          division.rpLoss,
          loserId,
        ]);
      }
      await tx.exec(
        "UPDATE duels SET status = 'completed', winner_id = ?, resolved_at = now() WHERE id = ?",
        [winnerId, duel.id],
      );
      resolved++;
    });
  }

  // Fixtures that will never get a score: refund both sides, no winner.
  const stale = await db().many<DuelRow>(
    `SELECT d.* FROM duels d JOIN fixtures f ON f.id = d.fixture_id
     WHERE d.status = 'live' AND f.completed = 0
       AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) * 1000 > ?`,
    [VOID_AFTER_MS],
  );
  for (const duel of stale) {
    await withTx(async (tx) => {
      await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p1_id]);
      if (duel.p2_id !== null) {
        await tx.exec("UPDATE players SET balance = balance + ? WHERE id = ?", [duel.stake, duel.p2_id]);
      }
      await tx.exec("UPDATE duels SET status = 'void', resolved_at = now() WHERE id = ?", [duel.id]);
    });
  }

  return resolved;
}

/** Lifetime duel record for the scoreboard strip on the Showdown page. */
export async function duelRecord(playerId: number): Promise<{ wins: number; played: number }> {
  const row = await db().one<{ wins: string; played: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE winner_id = ?) AS wins,
       COUNT(*) AS played
     FROM duels
     WHERE status = 'completed' AND (p1_id = ? OR p2_id = ?)`,
    [playerId, playerId, playerId],
  );
  return { wins: Number(row?.wins ?? 0), played: Number(row?.played ?? 0) };
}
