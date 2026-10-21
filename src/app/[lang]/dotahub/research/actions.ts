"use server";

import { getLabPicks } from "@/lib/dota/lab";

// The ten players of a match, for choosing whose game to study.
export async function labPlayers(matchId: number) {
  if (!Number.isInteger(matchId) || matchId <= 0) return null;
  return getLabPicks(matchId).catch(() => null);
}
