"use server";

import { getHeroLeaderboard, type LeaderboardRow } from "@/lib/dota/stratz";

// A hero's leaderboard at a rank tier (medal 1–8), for the 绝活 page.
export async function heroLeaderboard(heroId: number, tier: number): Promise<LeaderboardRow[] | null> {
  if (
    !Number.isInteger(heroId) ||
    heroId < 1 ||
    heroId > 1000 ||
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > 8
  )
    return null;
  return getHeroLeaderboard(heroId, tier).catch(() => null);
}
