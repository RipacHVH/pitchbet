import { NextResponse } from "next/server";

// No DB access on purpose — this exists purely so uptime pingers (Render's
// own health check, UptimeRobot, etc.) can keep the free-tier instance awake
// without generating any database load.
export async function GET() {
  return NextResponse.json({ ok: true });
}
