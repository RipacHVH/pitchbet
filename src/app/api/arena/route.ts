import { NextResponse } from "next/server";
import { getOrCreateOpenArena, arenaPayload, listMyArenas } from "@/lib/arena";
import { listChallenges } from "@/lib/challenges";
import { refreshStaleFixtures } from "@/lib/fixtures";
import { currentPlayer } from "@/lib/identity";
import { db, type ArenaRow } from "@/lib/db";
import { TIERS } from "@/lib/ranks";

// Note: arena settlement only happens via the explicit "Check results" button
// (POST /api/arena/settle or /api/bets/settle) — never passively on page load.
// Otherwise a player's picks could resolve silently before they ever see the
// result-reveal screen.
export async function GET() {
  const player = await currentPlayer();
  await refreshStaleFixtures(false);

  const arena = await getOrCreateOpenArena();
  const lastSettled = await db().one<ArenaRow>(
    "SELECT * FROM arenas WHERE status = 'settled' AND is_private = false ORDER BY settled_at DESC LIMIT 1",
  );

  return NextResponse.json({
    current: arena ? await arenaPayload(arena, player) : null,
    lastSettled: lastSettled ? await arenaPayload(lastSettled, player) : null,
    tiers: TIERS,
    me: player ? { id: player.id, username: player.username, rp: player.rp } : null,
    challenges: arena && player ? await listChallenges(arena.id, player.id) : [],
    myLeagues: player ? await listMyArenas(player.id) : [],
  });
}
