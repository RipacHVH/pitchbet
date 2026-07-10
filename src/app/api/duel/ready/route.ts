import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { readyUp, getMyDuel } from "@/lib/duel";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  let body: { division?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const res = await readyUp(player.id, body.division ?? "sunday");
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ duel: await getMyDuel(player.id) });
}
