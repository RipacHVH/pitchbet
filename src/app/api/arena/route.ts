import { NextResponse } from "next/server";
import { listMyArenas } from "@/lib/arena";
import { refreshStaleFixtures } from "@/lib/fixtures";
import { currentPlayer } from "@/lib/identity";

// Friends leagues only — the ranked ladder lives in the Showdown now.
// League settlement still only happens via the explicit "Check results"
// button, never passively on page load.
export async function GET() {
  const player = await currentPlayer();
  await refreshStaleFixtures(false);

  return NextResponse.json({
    me: player ? { id: player.id, username: player.username, rp: player.rp } : null,
    myLeagues: player ? await listMyArenas(player.id) : [],
  });
}
