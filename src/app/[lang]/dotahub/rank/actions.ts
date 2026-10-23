"use server";

import { getPlayerHeroesAs } from "@/lib/dota/data";
import {
  ALL_BRACKETS,
  MATCHUP_BRACKETS,
  MATCHUP_WEEKS,
  type MatchupBracket,
  type MatchupBracketChoice,
  type MatchupWeeks,
} from "@/lib/dota/matchup-range";
import { getHeroMatchups, type HeroMatchup } from "@/lib/dota/stratz";
import { againstOf, type Rec } from "./load";

const heroOk = (heroId: number) => Number.isInteger(heroId) && heroId >= 1 && heroId <= 1000;

// STRATZ's matchups of a hero at a bracket over the chosen range, for the 段位 page when the viewer
// picks another hero, bracket or range. null: STRATZ didn't answer (quota, outage); the client
// says so and offers a retry. An empty list: STRATZ has nothing there.
export async function heroMatchups(
  heroId: number,
  bracket: MatchupBracketChoice,
  weeks: MatchupWeeks,
): Promise<HeroMatchup[] | null> {
  if (!heroOk(heroId) || !MATCHUP_WEEKS.includes(weeks)) return null;
  if (bracket !== ALL_BRACKETS && !MATCHUP_BRACKETS.includes(bracket as MatchupBracket)) return null;
  return getHeroMatchups(heroId, bracket, weeks).catch(() => null);
}

// A player's own record on a hero against each other hero, from OpenDota (players shown from
// OpenDota only have it for their most played heroes up front).
export async function ownMatchupsAs(accountId: number, heroId: number): Promise<Record<number, Rec> | null> {
  if (!heroOk(heroId) || !Number.isSafeInteger(accountId) || accountId <= 0) return null;
  const rows = await getPlayerHeroesAs(accountId, heroId).catch(() => null);
  return rows ? againstOf(rows) : null;
}
