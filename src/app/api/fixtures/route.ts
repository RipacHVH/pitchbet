import { NextRequest, NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db";
import { creditsRemaining, refreshStaleFixtures, upcomingFixtures } from "@/lib/fixtures";

/** Manual refresh is rate-limited to once per 10 minutes across all users of this install. */
const FORCE_COOLDOWN_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  let forcedAllowed = false;
  if (force) {
    const last = await getMeta("last_forced_refresh");
    forcedAllowed = !last || Date.now() - Date.parse(last) > FORCE_COOLDOWN_MS;
    if (forcedAllowed) await setMeta("last_forced_refresh", new Date().toISOString());
  }

  const refreshed = await refreshStaleFixtures(force && forcedAllowed);

  return NextResponse.json({
    leagues: await upcomingFixtures(),
    refreshed,
    creditsRemaining: await creditsRemaining(),
  });
}
