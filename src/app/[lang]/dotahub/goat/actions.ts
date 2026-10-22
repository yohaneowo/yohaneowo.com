"use server";

import { getGoatScene, getLegendsView } from "@/lib/dota/goat";

export type GoatPick = {
  id: number;
  name: string;
  avatar: string | null;
  team: { id: number; name: string; logo: string | null; rank: number };
};

// The team id of the legends group.
const LEGENDS_GROUP = -1;

// The current pros of the ranked teams, for the economy / IMP compare menu's GOAT tab: one entry a
// player (their main account), by team place. Asked only when the tab opens (the scene is cached).
export async function goatPicks(): Promise<GoatPick[] | null> {
  const [scene, legends] = await Promise.all([
    getGoatScene().catch(() => null),
    getLegendsView().catch(() => []),
  ]);
  // The legends not on a team now, as a group of their own ahead of the teams (place 0). Unnamed:
  // a Server Action can't read the route's language (next/root-params), so the tab names it.
  const group = { id: LEGENDS_GROUP, name: "", logo: null, rank: 0 };
  const legendPicks: GoatPick[] = legends
    .filter((l) => !l.team)
    .map((l) => ({ id: l.legend.accounts[0], name: l.legend.name, avatar: l.photo, team: group }));
  if (!scene) return legendPicks.length ? legendPicks : null;
  const teams = new Map(scene.teams.map((team) => [team.id, team]));
  return scene.players
    .filter((p) => !p.stale && teams.has(p.teamId))
    .map((p) => {
      const team = teams.get(p.teamId)!;
      return {
        id: p.accounts[0].accountId,
        name: p.name,
        avatar: p.ps?.photo ?? p.accounts[0].avatar,
        team: { id: team.id, name: team.name, logo: team.logo ?? team.ps?.image ?? null, rank: team.rank },
      };
    })
    .concat(legendPicks)
    .sort((a, b) => a.team.rank - b.team.rank || a.name.localeCompare(b.name));
}
