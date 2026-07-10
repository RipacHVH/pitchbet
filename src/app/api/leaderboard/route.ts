import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { driftBotLadder } from "@/lib/duel";
import { getOrCreateActiveSeason, rotateSeasonIfDue } from "@/lib/seasons";

export async function GET() {
  const player = await currentPlayer();
  await rotateSeasonIfDue();
  const season = await getOrCreateActiveSeason();
  await driftBotLadder();

  const rows = await db().many<{
    id: number;
    username: string;
    rp: number;
    arena_wins: number;
    challenge_wins: number;
    season_wins: number;
    avatar: string | null;
  }>(
    `SELECT id, username, rp, arena_wins, challenge_wins, season_wins, avatar FROM players
     WHERE token IS NOT NULL OR password_hash IS NOT NULL OR is_bot
     ORDER BY rp DESC, arena_wins DESC, created_at ASC
     LIMIT 50`,
  );

  return NextResponse.json({
    players: rows,
    meId: player?.id ?? null,
    season: { id: season.id, name: season.name, endsAt: season.ends_at },
  });
}
