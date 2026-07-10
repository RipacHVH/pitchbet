import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";

const GRANT = 1000;

// Temporary testing faucet — remove before any real launch.
export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  await db().exec("UPDATE players SET balance = balance + ? WHERE id = ?", [GRANT, player.id]);
  const row = await db().one<{ balance: number }>("SELECT balance FROM players WHERE id = ?", [
    player.id,
  ]);
  return NextResponse.json({ granted: GRANT, newBalance: row!.balance });
}
