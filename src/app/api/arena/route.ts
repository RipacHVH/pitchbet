import { NextResponse } from "next/server";
import { getOrCreateOpenArena, arenaPayload, settleArenaRound } from "@/lib/arena";
import { refreshStaleFixtures } from "@/lib/fixtures";
import { currentPlayer } from "@/lib/identity";
import { db, type ArenaRow } from "@/lib/db";
import { TIERS } from "@/lib/ranks";

export async function GET() {
  const player = await currentPlayer();
  await refreshStaleFixtures(false);

  // Free (DB-only) settle pass so finished arenas flip to podium view even
  // if nobody pressed the settle button.
  await settleArenaRound();

  const arena = await getOrCreateOpenArena();
  const lastSettled = await db().one<ArenaRow>(
    "SELECT * FROM arenas WHERE status = 'settled' ORDER BY settled_at DESC LIMIT 1",
  );

  return NextResponse.json({
    current: arena ? await arenaPayload(arena, player) : null,
    lastSettled: lastSettled ? await arenaPayload(lastSettled, player) : null,
    tiers: TIERS,
    me: player ? { id: player.id, username: player.username, rp: player.rp } : null,
  });
}
