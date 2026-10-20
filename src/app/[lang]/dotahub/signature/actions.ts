"use server";

import { getHeroLeaderboard, getHeroLevelBoard, type LeaderboardRow, type LevelRow } from "@/lib/dota/stratz";

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

// A hero's Dota Plus level leaderboard (worldwide) with each player's ranked IMP and win rate on it.
export async function heroLevelBoard(heroId: number): Promise<LevelRow[] | null> {
  if (!Number.isInteger(heroId) || heroId < 1 || heroId > 1000) return null;
  return getHeroLevelBoard(heroId).catch(() => null);
}
