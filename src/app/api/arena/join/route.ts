import { NextRequest, NextResponse } from "next/server";
import { joinArena } from "@/lib/arena";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  let body: { arenaId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.arenaId) return NextResponse.json({ message: "arenaId required" }, { status: 400 });

  const result = await joinArena(body.arenaId, player.id);
  if (result.error) return NextResponse.json({ message: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
