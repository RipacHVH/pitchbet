import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { settleEverything } from "@/lib/settle";

export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Join first" }, { status: 401 });

  const summary = await settleEverything(player.id);
  const row = await db().one<{ balance: number }>("SELECT balance FROM players WHERE id = ?", [
    player.id,
  ]);
  return NextResponse.json({ ...summary, newBalance: row!.balance });
}
