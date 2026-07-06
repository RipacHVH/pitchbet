import { db, isUniqueViolation, withTx, type ArenaRow, type ChallengeRow } from "./db";

export interface ChallengeView {
  id: number;
  status: ChallengeRow["status"];
  createdAt: string;
  resolvedAt: string | null;
  isMine: boolean; // true if the current player sent this challenge
  me: { id: number; username: string; avatar: string | null; points: number };
  opponent: { id: number; username: string; avatar: string | null; points: number };
  won: boolean | null; // from the current player's perspective; null if unresolved/tied
}

/**
 * Send a head-to-head challenge for a specific arena. The challenger must
 * already be entered (there's nothing to compare otherwise); the opponent
 * is looked up by name and auto-entered into the arena once they accept.
 */
export async function createChallenge(
  arenaId: number,
  challengerId: number,
  opponentUsername: string,
): Promise<{ error?: string; status?: number; challenge?: ChallengeRow }> {
  const arena = await db().one<ArenaRow>("SELECT * FROM arenas WHERE id = ?", [arenaId]);
  if (!arena || arena.status !== "open") {
    return { error: "This arena has already been decided.", status: 409 };
  }

  const enteredCheck = await db().one(
    "SELECT 1 FROM arena_entries WHERE arena_id = ? AND player_id = ?",
    [arenaId, challengerId],
  );
  if (!enteredCheck) {
    return { error: "Enter the arena before challenging someone.", status: 409 };
  }

  const opponent = await db().one<{ id: number; username: string }>(
    "SELECT id, username FROM players WHERE lower(username) = lower(?)",
    [opponentUsername.trim()],
  );
  if (!opponent) return { error: "No player by that name.", status: 404 };
  if (opponent.id === challengerId) return { error: "You can't challenge yourself.", status: 400 };

  try {
    const created = await db().one<ChallengeRow>(
      `INSERT INTO challenges (arena_id, challenger_id, opponent_id) VALUES (?, ?, ?) RETURNING *`,
      [arenaId, challengerId, opponent.id],
    );
    return { challenge: created };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "You've already challenged that player this matchday.", status: 409 };
    }
    throw err;
  }
}

export async function respondToChallenge(
  challengeId: number,
  opponentId: number,
  accept: boolean,
): Promise<{ error?: string; status?: number }> {
  const challenge = await db().one<ChallengeRow>("SELECT * FROM challenges WHERE id = ?", [
    challengeId,
  ]);
  if (!challenge || challenge.opponent_id !== opponentId) {
    return { error: "Challenge not found.", status: 404 };
  }
  if (challenge.status !== "pending") {
    return { error: "That challenge was already answered.", status: 409 };
  }

  if (!accept) {
    await db().exec("UPDATE challenges SET status = 'declined' WHERE id = ?", [challengeId]);
    return {};
  }

  await withTx(async (tx) => {
    await tx.exec(
      "INSERT INTO arena_entries (arena_id, player_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
      [challenge.arena_id, opponentId],
    );
    await tx.exec("UPDATE challenges SET status = 'accepted' WHERE id = ?", [challengeId]);
  });
  return {};
}

/** All challenges (any status) involving this player for a given arena. */
export async function listChallenges(arenaId: number, playerId: number): Promise<ChallengeView[]> {
  const rows = await db().many<
    ChallengeRow & {
      challenger_username: string;
      challenger_avatar: string | null;
      challenger_points: number | null;
      opponent_username: string;
      opponent_avatar: string | null;
      opponent_points: number | null;
    }
  >(
    `SELECT c.*,
            pc.username AS challenger_username, pc.avatar AS challenger_avatar, ec.points AS challenger_points,
            po.username AS opponent_username, po.avatar AS opponent_avatar, eo.points AS opponent_points
     FROM challenges c
     JOIN players pc ON pc.id = c.challenger_id
     JOIN players po ON po.id = c.opponent_id
     LEFT JOIN arena_entries ec ON ec.arena_id = c.arena_id AND ec.player_id = c.challenger_id
     LEFT JOIN arena_entries eo ON eo.arena_id = c.arena_id AND eo.player_id = c.opponent_id
     WHERE c.arena_id = ? AND (c.challenger_id = ? OR c.opponent_id = ?)
     ORDER BY c.created_at DESC`,
    [arenaId, playerId, playerId],
  );

  return rows.map((r) => {
    const isMine = r.challenger_id === playerId;
    const me = isMine
      ? { id: r.challenger_id, username: r.challenger_username, avatar: r.challenger_avatar, points: r.challenger_points ?? 0 }
      : { id: r.opponent_id, username: r.opponent_username, avatar: r.opponent_avatar, points: r.opponent_points ?? 0 };
    const opponent = isMine
      ? { id: r.opponent_id, username: r.opponent_username, avatar: r.opponent_avatar, points: r.opponent_points ?? 0 }
      : { id: r.challenger_id, username: r.challenger_username, avatar: r.challenger_avatar, points: r.challenger_points ?? 0 };
    const won = r.status === "completed" ? (r.winner_id === null ? null : r.winner_id === me.id) : null;
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      isMine,
      me,
      opponent,
      won,
    };
  });
}

/**
 * Called when an arena finalizes: settle every accepted challenge tied to it
 * by comparing final points, crediting the winner's challenge_wins.
 */
export async function resolveChallengesForArena(arenaId: number): Promise<void> {
  const accepted = await db().many<ChallengeRow>(
    "SELECT * FROM challenges WHERE arena_id = ? AND status = 'accepted'",
    [arenaId],
  );
  if (accepted.length === 0) return;

  await withTx(async (tx) => {
    for (const c of accepted) {
      const points = await tx.many<{ player_id: number; points: number }>(
        "SELECT player_id, points FROM arena_entries WHERE arena_id = ? AND player_id IN (?, ?)",
        [arenaId, c.challenger_id, c.opponent_id],
      );
      const challengerPoints = points.find((p) => p.player_id === c.challenger_id)?.points ?? 0;
      const opponentPoints = points.find((p) => p.player_id === c.opponent_id)?.points ?? 0;
      const winnerId =
        challengerPoints === opponentPoints
          ? null
          : challengerPoints > opponentPoints
            ? c.challenger_id
            : c.opponent_id;

      await tx.exec(
        "UPDATE challenges SET status = 'completed', winner_id = ?, resolved_at = now() WHERE id = ?",
        [winnerId, c.id],
      );
      if (winnerId !== null) {
        await tx.exec("UPDATE players SET challenge_wins = challenge_wins + 1 WHERE id = ?", [
          winnerId,
        ]);
      }
    }
  });
}
