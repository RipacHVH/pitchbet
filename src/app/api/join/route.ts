import { NextRequest, NextResponse } from "next/server";
import { registerPlayer } from "@/lib/identity";
import { tierFor } from "@/lib/ranks";

export async function POST(req: NextRequest) {
  let body: { username?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.username || !body.email || !body.password) {
    return NextResponse.json(
      { message: "Player name, email and password are required" },
      { status: 400 },
    );
  }

  const result = await registerPlayer(body.username, body.email, body.password);
  if (result.error || !result.player) {
    return NextResponse.json({ message: result.error ?? "Join failed" }, { status: 409 });
  }
  const p = result.player;
  return NextResponse.json({
    username: p.username,
    balance: p.balance,
    rp: p.rp,
    tier: tierFor(p.rp).name,
  });
}
