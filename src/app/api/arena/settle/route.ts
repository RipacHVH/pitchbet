import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { settleEverything } from "@/lib/settle";

export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Join first" }, { status: 401 });
  const summary = await settleEverything(player.id);
  return NextResponse.json(summary);
}
