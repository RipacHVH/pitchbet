import { NextRequest, NextResponse } from "next/server";
import { placeArenaPick } from "@/lib/arena";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a manager name first" }, { status: 401 });

  let body: { arenaId?: number; fixtureId?: string; selection?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const { arenaId, fixtureId, selection } = body;
  if (!arenaId || !fixtureId || !selection || !["home", "draw", "away"].includes(selection)) {
    return NextResponse.json(
      { message: "arenaId, fixtureId and selection required" },
      { status: 400 },
    );
  }

  const entry = await db().one(
    "SELECT 1 FROM arena_entries WHERE arena_id = ? AND player_id = ?",
    [arenaId, player.id],
  );
  if (!entry) return NextResponse.json({ message: "Enter the arena first" }, { status: 409 });

  const result = await placeArenaPick(
    player.id,
    arenaId,
    fixtureId,
    selection as "home" | "draw" | "away",
  );
  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json(result.pick);
}
