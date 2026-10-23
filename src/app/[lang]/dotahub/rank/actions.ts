"use server";

import { getPlayerHeroesAs } from "@/lib/dota/data";
import { MATCHUP_WEEKS, type MatchupWeeks } from "@/lib/dota/matchup-range";
import { getHeroMatchups, type HeroMatchup } from "@/lib/dota/stratz";
import { againstOf, type Rec } from "./load";

const heroOk = (heroId: number) => Number.isInteger(heroId) && heroId >= 1 && heroId <= 1000;

// STRATZ's matchups of a hero at the bracket of a rank tier over the chosen range, for the 段位
// page when the viewer picks another hero or range.
export async function heroMatchups(
  heroId: number,
  tier: number,
  weeks: MatchupWeeks,
): Promise<HeroMatchup[] | null> {
  if (!heroOk(heroId) || !Number.isInteger(tier) || tier < 11 || tier > 80) return null;
  if (!MATCHUP_WEEKS.includes(weeks)) return null;
  return getHeroMatchups(heroId, tier, weeks).catch(() => null);
}

// A player's own record on a hero against each other hero, from OpenDota (players shown from
// OpenDota only have it for their most played heroes up front).
export async function ownMatchupsAs(accountId: number, heroId: number): Promise<Record<number, Rec> | null> {
  if (!heroOk(heroId) || !Number.isSafeInteger(accountId) || accountId <= 0) return null;
  const rows = await getPlayerHeroesAs(accountId, heroId).catch(() => null);
  return rows ? againstOf(rows) : null;
}
