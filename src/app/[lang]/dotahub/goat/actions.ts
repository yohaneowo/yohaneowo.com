"use server";

import { getGoatScene } from "@/lib/dota/goat";

export type GoatPick = {
  id: number;
  name: string;
  avatar: string | null;
  team: { id: number; name: string; logo: string | null; rank: number };
};

// The current pros of the ranked teams, for the economy / IMP compare menu's GOAT tab: one entry a
// player (their main account), by team place. Asked only when the tab opens (the scene is cached).
export async function goatPicks(): Promise<GoatPick[] | null> {
  const scene = await getGoatScene().catch(() => null);
  if (!scene) return null;
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
    .sort((a, b) => a.team.rank - b.team.rank || a.name.localeCompare(b.name));
}
