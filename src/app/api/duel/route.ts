import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { getMyDuel, duelRecord, DUEL_STAKE } from "@/lib/duel";
import { refreshStaleFixtures } from "@/lib/fixtures";

export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ duel: null, record: null, stake: DUEL_STAKE });
  await refreshStaleFixtures(false);

  return NextResponse.json({
    duel: await getMyDuel(player.id),
    record: await duelRecord(player.id),
    stake: DUEL_STAKE,
    me: { id: player.id, username: player.username, balance: player.balance },
  });
}
