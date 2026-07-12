import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";

const GRANT = 1000;

// Testing faucet. Only answers when DEV_FAUCET=1 (local .env.local) —
// in production it 404s, so release builds can't mint coins.
export async function POST() {
  if (process.env.DEV_FAUCET !== "1") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  await db().exec("UPDATE players SET balance = balance + ? WHERE id = ?", [GRANT, player.id]);
  const row = await db().one<{ balance: number }>("SELECT balance FROM players WHERE id = ?", [
    player.id,
  ]);
  return NextResponse.json({ granted: GRANT, newBalance: row!.balance });
}
