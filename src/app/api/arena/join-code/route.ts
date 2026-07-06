import { NextRequest, NextResponse } from "next/server";
import { joinArenaByCode } from "@/lib/arena";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.code) return NextResponse.json({ message: "Invite code required" }, { status: 400 });

  const result = await joinArenaByCode(player.id, body.code);
  if (result.error || !result.arena) {
    return NextResponse.json({ message: result.error ?? "Couldn't join" }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ arenaId: result.arena.id, name: result.arena.name });
}
