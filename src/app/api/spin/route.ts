import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";

// Segment order matches the wheel drawn on the client. Weights are strictly
// decreasing as the prize grows (out of 1000 spins): 25 lands 400 times,
// the 1000 jackpot 7 — a 57x rarity gap. Average payout ~76 coins/day.
export const WHEEL_SEGMENTS = [25, 50, 75, 100, 150, 250, 500, 1000];
const WEIGHTS = [400, 250, 140, 90, 60, 35, 18, 7];

function rollSegment(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const index = rollSegment();
  const prize = WHEEL_SEGMENTS[index];

  const claimed = await db().exec(
    `UPDATE players SET balance = balance + ?, last_daily_at = ?
     WHERE id = ? AND (last_daily_at IS NULL OR last_daily_at <> ?)`,
    [prize, today, player.id, today],
  );

  if (claimed.rowCount === 0) {
    return NextResponse.json({ message: "Already spun today — come back tomorrow." }, { status: 409 });
  }

  const row = await db().one<{ balance: number }>("SELECT balance FROM players WHERE id = ?", [
    player.id,
  ]);
  return NextResponse.json({ prize, index, newBalance: row!.balance });
}
