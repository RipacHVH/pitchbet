import {
  db,
  isUniqueViolation,
  withTx,
  type ArenaBetRow,
  type ArenaRow,
  type FixtureRow,
  type PlayerRow,
} from "./db";
import { rpForOdds } from "./ranks";
import { resolveChallengesForArena } from "./challenges";

const SLATE_SIZE = 5;

export interface ArenaStanding {
  player_id: number;
  username: string;
  rp: number;
  avatar: string | null;
  points: number;
  final_rank: number | null;
  picks: number;
}

export interface ArenaPayload {
  arena: ArenaRow;
  fixtures: FixtureRow[];
  entry: { points: number; final_rank: number | null } | null;
  myBets: ArenaBetRow[];
  standings: ArenaStanding[];
}

export interface ArenaRevealItem {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  selection: "home" | "draw" | "away";
  odds: number;
  rpDelta: number;
  won: boolean;
}

/** The one open *public* arena, creating it from the next upcoming matches if needed. */
export async function getOrCreateOpenArena(): Promise<ArenaRow | null> {
  const open = await db().one<ArenaRow>(
    "SELECT * FROM arenas WHERE status = 'open' AND is_private = false LIMIT 1",
  );
  if (open) return open;

  const slate = await nextSlate();
  if (slate.length < 2) return null;

  return withTx(async (tx) => {
    const created = await tx.one<{ id: number }>("INSERT INTO arenas (name) VALUES ('') RETURNING id");
    const id = created!.id;
    await tx.exec("UPDATE arenas SET name = ? WHERE id = ?", [`Matchday #${id}`, id]);
    for (const f of slate) {
      await tx.exec("INSERT INTO arena_fixtures (arena_id, fixture_id) VALUES (?, ?)", [id, f.id]);
    }
    return (await tx.one<ArenaRow>("SELECT * FROM arenas WHERE id = ?", [id]))!;
  });
}

async function nextSlate(): Promise<{ id: string }[]> {
  return db().many<{ id: string }>(
    `SELECT id FROM fixtures
     WHERE completed = 0 AND commence_time > ? AND home_odds IS NOT NULL
     ORDER BY commence_time ASC LIMIT ?`,
    [new Date().toISOString(), SLATE_SIZE],
  );
}

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I — easy to read aloud

function randomInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

/**
 * Create a private league: same 5-match slate mechanism as the public
 * Matchday, but invite-only and independent — many can coexist alongside
 * each other and the public arena. The creator is auto-entered.
 */
export async function createPrivateArena(
  creatorId: number,
  name: string,
): Promise<{ error?: string; arena?: ArenaRow }> {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 40) {
    return { error: "League name must be 3–40 characters." };
  }

  const slate = await nextSlate();
  if (slate.length < 2) {
    return { error: "Not enough upcoming matches with odds yet — try again soon." };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    try {
      return await withTx(async (tx) => {
        const created = await tx.one<{ id: number }>(
          "INSERT INTO arenas (name, is_private, invite_code, created_by) VALUES (?, true, ?, ?) RETURNING id",
          [trimmed, code, creatorId],
        );
        const id = created!.id;
        for (const f of slate) {
          await tx.exec("INSERT INTO arena_fixtures (arena_id, fixture_id) VALUES (?, ?)", [id, f.id]);
        }
        await tx.exec("INSERT INTO arena_entries (arena_id, player_id) VALUES (?, ?)", [id, creatorId]);
        return { arena: (await tx.one<ArenaRow>("SELECT * FROM arenas WHERE id = ?", [id]))! };
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue; // invite code collision, retry with a new one
      throw err;
    }
  }
  return { error: "Couldn't generate a unique invite code — try again." };
}

export async function joinArenaByCode(
  playerId: number,
  code: string,
): Promise<{ error?: string; status?: number; arena?: ArenaRow }> {
  const arena = await db().one<ArenaRow>("SELECT * FROM arenas WHERE invite_code = ?", [
    code.trim().toUpperCase(),
  ]);
  if (!arena) return { error: "No league with that code.", status: 404 };
  if (arena.status !== "open") return { error: "That league has already finished.", status: 409 };

  await db().exec(
    "INSERT INTO arena_entries (arena_id, player_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
    [arena.id, playerId],
  );
  return { arena };
}

export interface MyArenaSummary {
  id: number;
  name: string;
  status: "open" | "settled";
  inviteCode: string | null;
  points: number;
  finalRank: number | null;
  memberCount: number;
}

/** Private leagues this player belongs to, for the "My Leagues" switcher. */
export async function listMyArenas(playerId: number): Promise<MyArenaSummary[]> {
  const rows = await db().many<MyArenaSummary>(
    `SELECT a.id, a.name, a.status, a.invite_code AS "inviteCode",
            e.points, e.final_rank AS "finalRank",
            (SELECT COUNT(*) FROM arena_entries e2 WHERE e2.arena_id = a.id) AS "memberCount"
     FROM arena_entries e
     JOIN arenas a ON a.id = e.arena_id
     WHERE e.player_id = ? AND a.is_private = true
     ORDER BY a.status ASC, a.created_at DESC`,
    [playerId],
  );
  // COUNT(*) comes back as a string via node-postgres; normalize to number.
  for (const r of rows) r.memberCount = Number(r.memberCount);
  return rows;
}

export async function arenaPayload(
  arena: ArenaRow,
  player: PlayerRow | null,
): Promise<ArenaPayload> {
  const fixtures = await db().many<FixtureRow>(
    `SELECT f.* FROM arena_fixtures af JOIN fixtures f ON f.id = af.fixture_id
     WHERE af.arena_id = ? ORDER BY f.commence_time ASC`,
    [arena.id],
  );

  const entry = player
    ? ((await db().one<ArenaPayload["entry"]>(
        "SELECT points, final_rank FROM arena_entries WHERE arena_id = ? AND player_id = ?",
        [arena.id, player.id],
      )) ?? null)
    : null;

  const myBets = player
    ? await db().many<ArenaBetRow>(
        "SELECT * FROM arena_bets WHERE arena_id = ? AND player_id = ?",
        [arena.id, player.id],
      )
    : [];

  const standings = await db().many<ArenaStanding>(
    `SELECT e.player_id, p.username, p.rp, p.avatar, e.points, e.final_rank,
            (SELECT COUNT(*) FROM arena_bets ab
              WHERE ab.arena_id = e.arena_id AND ab.player_id = e.player_id) AS picks
     FROM arena_entries e JOIN players p ON p.id = e.player_id
     WHERE e.arena_id = ?
     ORDER BY COALESCE(e.final_rank, 999999), e.points DESC, e.joined_at ASC`,
    [arena.id],
  );
  // count(*) comes back as a string via node-postgres; normalize to number
  for (const s of standings) s.picks = Number(s.picks);

  return { arena, fixtures, entry, myBets, standings };
}

export async function joinArena(arenaId: number, playerId: number): Promise<{ error?: string }> {
  const arena = await db().one<ArenaRow>("SELECT * FROM arenas WHERE id = ?", [arenaId]);
  if (!arena || arena.status !== "open") return { error: "This arena has already been decided." };
  await db().exec(
    "INSERT INTO arena_entries (arena_id, player_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
    [arenaId, playerId],
  );
  return {};
}

/**
 * Lock a pick. No stake: the odds themselves are the wager — win the match
 * and the pick pays odds x 10 RP; lose and the same amount is deducted.
 */
export async function placeArenaPick(
  playerId: number,
  arenaId: number,
  fixtureId: string,
  selection: "home" | "draw" | "away",
): Promise<{ error?: string; status?: number; pick?: { odds: number; rpAtStake: number } }> {
  const fixture = await db().one<FixtureRow>(
    `SELECT f.* FROM arena_fixtures af JOIN fixtures f ON f.id = af.fixture_id
     WHERE af.arena_id = ? AND f.id = ?`,
    [arenaId, fixtureId],
  );
  if (!fixture) return { error: "That match isn't in this arena.", status: 404 };
  if (fixture.completed || Date.parse(fixture.commence_time) <= Date.now()) {
    return { error: "Too late — that match has kicked off.", status: 409 };
  }

  const odds = { home: fixture.home_odds, draw: fixture.draw_odds, away: fixture.away_odds }[
    selection
  ];
  if (!odds) return { error: "No odds for that outcome.", status: 409 };

  try {
    await db().exec(
      `INSERT INTO arena_bets (arena_id, player_id, fixture_id, selection, odds)
       VALUES (?, ?, ?, ?, ?)`,
      [arenaId, playerId, fixtureId, selection, odds],
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "Your pick for this match is already locked.", status: 409 };
    }
    throw err;
  }
  return { pick: { odds, rpAtStake: rpForOdds(odds) } };
}

/**
 * Score decided picks (right: +odds x 10 RP, wrong: same amount lost, global
 * RP floored at 0), then finalize any arena whose whole slate is resolved.
 *
 * Settlement is global, but callerId scopes the returned reveal list to what
 * that specific player should see on their result-reveal screen.
 */
export async function settleArenaRound(
  callerId?: number,
): Promise<{ finalized: number[]; reveal: ArenaRevealItem[] }> {
  const decided = await db().many<
    ArenaBetRow & Pick<FixtureRow, "home_team" | "away_team" | "home_score" | "away_score">
  >(
    `SELECT ab.*, f.home_team, f.away_team, f.home_score, f.away_score FROM arena_bets ab
     JOIN fixtures f ON f.id = ab.fixture_id
     WHERE ab.status = 'open' AND f.completed = 1
       AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL`,
  );

  const reveal: ArenaRevealItem[] = [];

  if (decided.length > 0) {
    await withTx(async (tx) => {
      for (const pick of decided) {
        // WHERE clause above guarantees these are non-null.
        const homeScore = pick.home_score!;
        const awayScore = pick.away_score!;
        const winner = homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";
        const won = pick.selection === winner;
        const atStake = rpForOdds(pick.odds);
        const delta = won ? atStake : -atStake;
        await tx.exec("UPDATE arena_bets SET status = ?, rp_delta = ? WHERE id = ?", [
          won ? "won" : "lost",
          delta,
          pick.id,
        ]);
        await tx.exec(
          "UPDATE arena_entries SET points = points + ? WHERE arena_id = ? AND player_id = ?",
          [delta, pick.arena_id, pick.player_id],
        );
        await tx.exec("UPDATE players SET rp = GREATEST(0, rp + ?) WHERE id = ?", [
          delta,
          pick.player_id,
        ]);
        if (callerId !== undefined && pick.player_id === callerId) {
          reveal.push({
            fixtureId: pick.fixture_id,
            homeTeam: pick.home_team,
            awayTeam: pick.away_team,
            homeScore,
            awayScore,
            selection: pick.selection,
            odds: pick.odds,
            rpDelta: delta,
            won,
          });
        }
      }
    });
  }

  // Void picks on matches that will never get a score (older than the 3-day
  // scores window) so the arena can still finalize. No RP moves either way.
  await db().exec(
    `UPDATE arena_bets SET status = 'void', rp_delta = 0 WHERE id IN (
       SELECT ab.id FROM arena_bets ab JOIN fixtures f ON f.id = ab.fixture_id
       WHERE ab.status = 'open' AND f.completed = 0
         AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) / 86400 > 4
     )`,
  );

  // Finalize arenas whose slate is fully resolved
  const done = await db().many<{ id: number }>(
    `SELECT a.id FROM arenas a WHERE a.status = 'open'
     AND NOT EXISTS (
       SELECT 1 FROM arena_fixtures af JOIN fixtures f ON f.id = af.fixture_id
       WHERE af.arena_id = a.id AND f.completed = 0
         AND EXTRACT(EPOCH FROM (now() - f.commence_time::timestamptz)) / 86400 <= 4
     )
     AND NOT EXISTS (
       SELECT 1 FROM arena_bets ab WHERE ab.arena_id = a.id AND ab.status = 'open'
     )`,
  );

  const finalized: number[] = [];
  for (const { id } of done) {
    const entries = await db().many<{ player_id: number; points: number }>(
      `SELECT player_id, points FROM arena_entries WHERE arena_id = ?
       ORDER BY points DESC, joined_at ASC`,
      [id],
    );

    await withTx(async (tx) => {
      let rank = 0;
      let lastPoints = Number.NaN;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.points !== lastPoints) {
          rank = i + 1;
          lastPoints = e.points;
        }
        await tx.exec(
          "UPDATE arena_entries SET final_rank = ? WHERE arena_id = ? AND player_id = ?",
          [rank, id, e.player_id],
        );
        if (rank === 1 && e.points > 0) {
          await tx.exec("UPDATE players SET arena_wins = arena_wins + 1 WHERE id = ?", [
            e.player_id,
          ]);
        }
      }
      await tx.exec("UPDATE arenas SET status = 'settled', settled_at = now() WHERE id = ?", [id]);
    });
    await resolveChallengesForArena(id);
    finalized.push(id);
  }
  return { finalized, reveal };
}
