import type { NextRequest } from "next/server";
import { dotaCalls, dotaHealth } from "@/lib/dota/health";

// The state of DotaHub's sources (OpenDota, STRATZ, Steam) for the dots in its navigation. With
// ?calls, also how many calls each kind of request has made since this process started — what is
// spending the quotas.
export async function GET(request: NextRequest) {
  const health = await dotaHealth();
  const body = request.nextUrl.searchParams.has("calls") ? { ...health, calls: dotaCalls() } : health;
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
