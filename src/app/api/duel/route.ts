import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { getMyDuel, duelRecord, DIVISIONS } from "@/lib/duel";
import { refreshStaleFixtures } from "@/lib/fixtures";
import { TIERS } from "@/lib/ranks";

export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ duel: null, record: null, divisions: DIVISIONS, tiers: TIERS });
  await refreshStaleFixtures(false);

  return NextResponse.json({
    duel: await getMyDuel(player.id),
    record: await duelRecord(player.id),
    divisions: DIVISIONS,
    tiers: TIERS,
    me: {
      id: player.id,
      username: player.username,
      balance: player.balance,
      rp: player.rp,
      duelWins: player.duel_wins,
    },
  });
}
