import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { submitPick, getMyDuel } from "@/lib/duel";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a player name first" }, { status: 401 });

  let body: { selection?: string; homeGoals?: number; awayGoals?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const res = await submitPick(
    player.id,
    body.selection ?? "",
    body.homeGoals ?? -1,
    body.awayGoals ?? -1,
  );
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ duel: await getMyDuel(player.id) });
}
