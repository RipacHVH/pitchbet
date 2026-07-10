import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { cancelSearch } from "@/lib/duel";

export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  const res = await cancelSearch(player.id);
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ ok: true });
}
