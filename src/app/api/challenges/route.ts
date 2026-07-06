import { NextRequest, NextResponse } from "next/server";
import { createChallenge } from "@/lib/challenges";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let body: { arenaId?: number; opponentUsername?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.arenaId || !body.opponentUsername) {
    return NextResponse.json({ message: "arenaId and opponentUsername required" }, { status: 400 });
  }

  const result = await createChallenge(body.arenaId, player.id, body.opponentUsername);
  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ ok: true });
}
