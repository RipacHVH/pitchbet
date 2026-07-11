import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/identity";
import { claimQuest } from "@/lib/quests";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let body: { questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.questId) return NextResponse.json({ message: "questId required" }, { status: 400 });

  const res = await claimQuest(player.id, body.questId);
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ reward: res.reward });
}
