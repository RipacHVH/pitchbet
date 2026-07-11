import { db, isUniqueViolation } from "./db";

/**
 * Weekly quests: three rotate in each ISO week, progress is computed straight
 * from the tables the game already writes (no tracking hooks), and a claim
 * pays coins exactly once. Everything is visible up front — no mystery boxes.
 */

export interface QuestDef {
  id: string;
  title: string;
  target: number;
  reward: number;
  emoji: string;
}

const QUEST_POOL: QuestDef[] = [
  { id: "win-duels", title: "Win 2 Showdown duels", target: 2, reward: 300, emoji: "⚔️" },
  { id: "play-duels", title: "Play 3 Showdown duels", target: 3, reward: 200, emoji: "🎫" },
  { id: "underdog", title: "Win a bet at odds 2.5+", target: 1, reward: 250, emoji: "🐺" },
  { id: "career-wins", title: "Win 3 career bets", target: 3, reward: 250, emoji: "📈" },
  { id: "league-picks", title: "Lock 3 friends-league picks", target: 3, reward: 200, emoji: "🏟️" },
  { id: "career-bets", title: "Place 4 career bets", target: 4, reward: 150, emoji: "🎯" },
];

const ACTIVE_PER_WEEK = 3;

export interface QuestView extends QuestDef {
  progress: number;
  claimed: boolean;
  claimable: boolean;
}

/** ISO-week key like "2026-W28" plus that week's Monday 00:00 UTC. */
export function currentWeek(): { key: string; startIso: string } {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  // ISO week number from the Thursday of this week
  const thursday = new Date(monday.getTime() + 3 * 86_400_000);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return {
    key: `${thursday.getUTCFullYear()}-W${`${week}`.padStart(2, "0")}`,
    startIso: monday.toISOString(),
  };
}

function activeQuests(weekKey: string): QuestDef[] {
  // Deterministic rotation: consecutive slice of the pool, shifting each week.
  const weekNum = Number(weekKey.slice(-2)) + Number(weekKey.slice(0, 4));
  const out: QuestDef[] = [];
  for (let i = 0; i < ACTIVE_PER_WEEK; i++) {
    out.push(QUEST_POOL[(weekNum + i) % QUEST_POOL.length]);
  }
  return out;
}

async function questProgress(questId: string, playerId: number, sinceIso: string): Promise<number> {
  switch (questId) {
    case "win-duels": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM duels WHERE winner_id = ? AND resolved_at >= ?::timestamptz`,
        [playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    case "play-duels": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM duels
         WHERE (p1_id = ? OR p2_id = ?) AND status IN ('live','completed')
           AND matched_at >= ?::timestamptz`,
        [playerId, playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    case "underdog": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM bets
         WHERE user_id = ? AND status = 'won' AND odds >= 2.5 AND settled_at >= ?::timestamptz`,
        [playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    case "career-wins": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM bets
         WHERE user_id = ? AND status = 'won' AND settled_at >= ?::timestamptz`,
        [playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    case "career-bets": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM bets WHERE user_id = ? AND created_at >= ?::timestamptz`,
        [playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    case "league-picks": {
      const r = await db().one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM arena_bets WHERE player_id = ? AND created_at >= ?::timestamptz`,
        [playerId, sinceIso],
      );
      return Number(r?.n ?? 0);
    }
    default:
      return 0;
  }
}

export async function listQuests(playerId: number): Promise<{ weekKey: string; quests: QuestView[] }> {
  const { key, startIso } = currentWeek();
  const defs = activeQuests(key);

  const claims = await db().many<{ quest_key: string }>(
    `SELECT quest_key FROM quest_claims WHERE player_id = ? AND quest_key LIKE ?`,
    [playerId, `${key}:%`],
  );
  const claimedIds = new Set(claims.map((c) => c.quest_key.split(":")[1]));

  const quests: QuestView[] = [];
  for (const def of defs) {
    const claimed = claimedIds.has(def.id);
    const progress = claimed ? def.target : Math.min(def.target, await questProgress(def.id, playerId, startIso));
    quests.push({ ...def, progress, claimed, claimable: !claimed && progress >= def.target });
  }
  return { weekKey: key, quests };
}

export async function claimQuest(
  playerId: number,
  questId: string,
): Promise<{ error?: string; status?: number; reward?: number }> {
  const { key, startIso } = currentWeek();
  const def = activeQuests(key).find((q) => q.id === questId);
  if (!def) return { error: "That quest isn't active this week.", status: 404 };

  const progress = await questProgress(questId, playerId, startIso);
  if (progress < def.target) return { error: "Not done yet — keep going.", status: 409 };

  try {
    await db().exec(`INSERT INTO quest_claims (player_id, quest_key) VALUES (?, ?)`, [
      playerId,
      `${key}:${questId}`,
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Already claimed.", status: 409 };
    throw err;
  }
  await db().exec(`UPDATE players SET balance = balance + ? WHERE id = ?`, [def.reward, playerId]);
  return { reward: def.reward };
}
