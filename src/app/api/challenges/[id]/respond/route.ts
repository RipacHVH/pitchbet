import { NextRequest, NextResponse } from "next/server";
import { respondToChallenge } from "@/lib/challenges";
import { currentPlayer } from "@/lib/identity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  const { id } = await params;
  const challengeId = Number(id);
  if (!Number.isInteger(challengeId)) {
    return NextResponse.json({ message: "Invalid challenge id" }, { status: 400 });
  }

  let body: { accept?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.accept !== "boolean") {
    return NextResponse.json({ message: "accept (boolean) required" }, { status: 400 });
  }

  const result = await respondToChallenge(challengeId, player.id, body.accept);
  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ ok: true });
}
