import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { listQuests } from "@/lib/quests";

export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ weekKey: null, quests: [] });
  return NextResponse.json(await listQuests(player.id));
}
