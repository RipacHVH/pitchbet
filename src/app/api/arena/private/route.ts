import { NextRequest, NextResponse } from "next/server";
import { createPrivateArena } from "@/lib/arena";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ message: "League name required" }, { status: 400 });

  const result = await createPrivateArena(player.id, body.name);
  if (result.error || !result.arena) {
    return NextResponse.json({ message: result.error ?? "Couldn't create the league" }, { status: 400 });
  }
  return NextResponse.json({
    arenaId: result.arena.id,
    name: result.arena.name,
    inviteCode: result.arena.invite_code,
  });
}
