import { NextResponse } from "next/server";
import { arenaPayload } from "@/lib/arena";
import { listChallenges } from "@/lib/challenges";
import { currentPlayer } from "@/lib/identity";
import { db, type ArenaRow } from "@/lib/db";

/** A single arena by id — used to view a specific private league (any status). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const arenaId = Number(id);
  if (!Number.isInteger(arenaId)) {
    return NextResponse.json({ message: "Invalid arena id" }, { status: 400 });
  }

  const player = await currentPlayer();
  const arena = await db().one<ArenaRow>("SELECT * FROM arenas WHERE id = ?", [arenaId]);
  if (!arena) return NextResponse.json({ message: "League not found" }, { status: 404 });

  return NextResponse.json({
    arena: await arenaPayload(arena, player),
    challenges: player ? await listChallenges(arena.id, player.id) : [],
  });
}
