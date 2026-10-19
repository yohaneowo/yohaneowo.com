import { dotaHealth } from "@/lib/dota/health";

// The state of DotaHub's sources (OpenDota, STRATZ, Steam) for the dots in its navigation.
export async function GET() {
  return Response.json(await dotaHealth(), { headers: { "Cache-Control": "no-store" } });
}
