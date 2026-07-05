import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { tierFor } from "@/lib/ranks";
import { parseAvatar } from "@/lib/avatar";

export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ joined: false });

  const openBets = await db().one<{ n: string }>(
    "SELECT COUNT(*) AS n FROM bets WHERE status = 'open' AND user_id = ?",
    [player.id],
  );

  const owned = (
    await db().many<{ item_id: string }>("SELECT item_id FROM player_items WHERE player_id = ?", [
      player.id,
    ])
  ).map((r) => r.item_id);

  return NextResponse.json({
    joined: true,
    username: player.username,
    balance: player.balance,
    rp: player.rp,
    tier: tierFor(player.rp).name,
    arenaWins: player.arena_wins,
    openBets: Number(openBets?.n ?? 0),
    spinAvailable: player.last_daily_at !== new Date().toISOString().slice(0, 10),
    avatar: parseAvatar(player.avatar),
    ownedItems: owned,
  });
}
