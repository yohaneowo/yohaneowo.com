import "server-only";
import { findPsTeam, getPsTeams, norm, type PsPlayer, sameNick } from "./pandascore";
import { getProDetails, getProScene, type ProDetails, type ProPlayer, type ProTeam } from "./pro";

// GOAT's scene: OpenDota's teams and accounts with PandaScore's rosters on top. Where PandaScore
// has a roster for a team (3 players or more), it decides who is on it: its players are matched to
// accounts by name (and moved to the team when OpenDota still lists them elsewhere), the team's
// other OpenDota accounts are marked stale, and its players without an account are listed apart.

export type GoatPlayer = ProPlayer & { ps?: PsPlayer; stale?: boolean };
export type GoatTeam = ProTeam & {
  ps: { id: number; name: string; image: string | null; location: string | null } | null;
  // PandaScore's players for the team with no account found yet.
  psOnly: PsPlayer[];
};
export type GoatScene = { teams: GoatTeam[]; players: GoatPlayer[]; at: number; psAt: number | null };

export async function getGoatScene(): Promise<GoatScene> {
  const scene = await getProScene();
  const ps = await getPsTeams(scene.teams.map((t) => t.name)).catch(() => null);
  const players: GoatPlayer[] = scene.players.map((p) => ({ ...p }));
  const taken = new Set<string>();
  const teams: GoatTeam[] = scene.teams.map((team) => {
    const found = ps ? findPsTeam(ps.teams, team.name, team.tag) : undefined;
    const base = {
      ...team,
      ps: found ? { id: found.id, name: found.name, image: found.image, location: found.location } : null,
      psOnly: [] as PsPlayer[],
    };
    if (!found || found.players.length < 3) return base;
    const mine = new Set<string>();
    for (const p of found.players) {
      const candidate =
        players.find((x) => !taken.has(x.key) && x.teamId === team.id && sameNick(x.name, p.name)) ??
        // Elsewhere only on the exact name: short nicknames repeat across the scene.
        players.find((x) => !taken.has(x.key) && norm(x.name) === norm(p.name));
      if (candidate) {
        candidate.ps = p;
        candidate.teamId = team.id;
        // An earlier team may have marked them stale before they turned out to be here.
        candidate.stale = false;
        if (!candidate.country && p.nationality) candidate.country = p.nationality;
        taken.add(candidate.key);
        mine.add(candidate.key);
      } else base.psOnly.push(p);
    }
    for (const x of players) if (x.teamId === team.id && !mine.has(x.key)) x.stale = true;
    return base;
  });
  // A second look for PandaScore players left without an account: the team's stale accounts by the
  // name STRATZ knows the pro by, or their Steam name (ATF on PandaScore is AMMAR_THE_F on OpenDota).
  const open = teams.filter((x) => x.psOnly.length);
  const stale = players.filter((x) => x.stale && open.some((team) => team.id === x.teamId));
  if (stale.length) {
    const details = await getProDetails(stale.map((x) => x.accounts[0].accountId)).catch(() => ({}));
    for (const team of open)
      team.psOnly = team.psOnly.filter((p) => {
        const candidate = stale.find((x) => {
          if (x.teamId !== team.id || !x.stale) return false;
          const d = (details as Record<number, ProDetails>)[x.accounts[0].accountId];
          return sameNick(d?.proName ?? "", p.name) || sameNick(d?.persona ?? "", p.name);
        });
        if (!candidate) return true;
        candidate.ps = p;
        candidate.stale = false;
        if (!candidate.country && p.nationality) candidate.country = p.nationality;
        return false;
      });
  }
  return { teams, players, at: scene.at, psAt: ps?.at ?? null };
}

// The name to show for a PandaScore player's real name.
export const realName = (p: PsPlayer | undefined) =>
  p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || null : null;
