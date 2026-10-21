import "server-only";
import { cacheLife } from "next/cache";
import { getJson } from "./data";
import { stratzQuery } from "./stratz";

// The pro scene for GOAT: OpenDota's team ratings, its register of pro accounts (who plays for which
// team, with every known account of a player) and team pages; STRATZ adds what OpenDota lacks about
// a player (real name, position, sponsor, links, the season rank and leaderboard place). All of it
// is cached and refetched in the background, so the teams and rosters keep themselves up to date.

const OPENDOTA = "https://api.opendota.com/api";

// A team counts as active with a match in this many days; the list keeps this many of them.
const ACTIVE_DAYS = 120;
const TOP_TEAMS = 80;
// Pros without an active team still show when they played this recently.
const FREE_AGENT_DAYS = 90;

export type ProTeam = {
  id: number;
  name: string;
  tag: string;
  logo: string | null;
  rating: number;
  wins: number;
  losses: number;
  lastMatch: number;
  // 1-based place by rating among the active teams.
  rank: number;
};

// One pro account (a player can have several).
export type ProAccount = {
  accountId: number;
  steamId: string | null;
  name: string;
  persona: string | null;
  avatar: string | null;
  country: string | null;
  // OpenDota's fantasy role: 1 core, 2 support (0: unknown).
  role: number;
  teamId: number;
  lastMatch: number | null;
  locked: boolean;
  profile: string | null;
};

// A player: the accounts with the same name on the same team, the most recently played first.
export type ProPlayer = {
  key: string;
  name: string;
  teamId: number;
  country: string | null;
  role: number;
  accounts: ProAccount[];
};

export type ProScene = { teams: ProTeam[]; players: ProPlayer[]; at: number };

type RawTeam = {
  team_id: number;
  rating: number;
  wins: number;
  losses: number;
  last_match_time: number;
  name: string | null;
  tag: string | null;
  logo_url: string | null;
};

type RawPro = {
  account_id: number;
  steamid: string | null;
  avatarfull: string | null;
  profileurl: string | null;
  personaname: string | null;
  last_match_time: string | null;
  name: string | null;
  country_code: string | null;
  fantasy_role: number | null;
  team_id: number | null;
  is_locked: boolean | null;
  is_pro: boolean | null;
};

const unix = (iso: string | null) => (iso ? Math.floor(Date.parse(iso) / 1000) || null : null);
const slug = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// Accounts → players: the same name on the same team is one person.
export function groupPlayers(accounts: ProAccount[]): ProPlayer[] {
  const by = new Map<string, ProAccount[]>();
  for (const a of accounts) {
    const key = `${a.teamId}-${slug(a.name) || a.accountId}`;
    by.set(key, [...(by.get(key) ?? []), a]);
  }
  return [...by.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => (b.lastMatch ?? 0) - (a.lastMatch ?? 0));
    const main = sorted[0];
    return {
      key,
      name: main.name,
      teamId: main.teamId,
      country: sorted.find((a) => a.country)?.country ?? null,
      role: sorted.find((a) => a.role)?.role ?? 0,
      accounts: sorted,
    };
  });
}

function account(p: RawPro): ProAccount {
  return {
    accountId: p.account_id,
    steamId: p.steamid,
    name: (p.name ?? p.personaname ?? String(p.account_id)).trim(),
    persona: p.personaname,
    avatar: p.avatarfull,
    country: p.country_code ? p.country_code.toLowerCase() : null,
    role: p.fantasy_role ?? 0,
    teamId: p.team_id ?? 0,
    lastMatch: unix(p.last_match_time),
    locked: !!p.is_locked,
    profile: p.profileurl,
  };
}

// The active teams by rating and their players (plus pros without an active team who still play).
export async function getProScene(): Promise<ProScene> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 6 * 3600, expire: 7 * 24 * 3600 });
  const [teams, pros] = await Promise.all([
    getJson<RawTeam[]>(`${OPENDOTA}/teams`),
    getJson<RawPro[]>(`${OPENDOTA}/proPlayers`),
  ]);
  const now = Date.now() / 1000;
  const active = teams
    .filter((t) => t.name && t.last_match_time >= now - ACTIVE_DAYS * 86400)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, TOP_TEAMS)
    .map((t, i): ProTeam => ({
      id: t.team_id,
      name: t.name!.trim(),
      tag: (t.tag ?? "").trim(),
      logo: t.logo_url || null,
      rating: t.rating,
      wins: t.wins,
      losses: t.losses,
      lastMatch: t.last_match_time,
      rank: i + 1,
    }));
  const ids = new Set(active.map((t) => t.id));
  const accounts = pros
    .filter(
      (p) =>
        (p.team_id && ids.has(p.team_id)) ||
        (p.is_pro && (unix(p.last_match_time) ?? 0) >= now - FREE_AGENT_DAYS * 86400),
    )
    .map(account)
    .map((a) => (ids.has(a.teamId) ? a : { ...a, teamId: 0 }));

  // Teams nobody in the register plays for: their current members from the team's own list, with
  // STRATZ's name and picture (a few teams, so a few calls).
  const covered = new Set(accounts.map((a) => a.teamId));
  const missing = active.filter((t) => !covered.has(t.id)).slice(0, 20);
  type RawMember = { account_id: number; name: string | null; is_current_team_member: boolean | null };
  const lists = await Promise.all(
    missing.map((t) =>
      getJson<RawMember[]>(`${OPENDOTA}/teams/${t.id}/players`)
        .then((members) => members.filter((m) => m.is_current_team_member).map((m) => ({ team: t.id, ...m })))
        .catch(() => []),
    ),
  );
  const found = lists.flat().filter((m) => !accounts.some((a) => a.accountId === m.account_id));
  const details = found.length ? await getProDetails(found.map((m) => m.account_id)).catch(() => ({})) : {};
  for (const m of found) {
    const d = (details as Record<number, ProDetails>)[m.account_id];
    accounts.push({
      accountId: m.account_id,
      steamId: null,
      name: (m.name ?? d?.persona ?? String(m.account_id)).trim(),
      persona: d?.persona ?? null,
      avatar: d?.avatar ?? null,
      country: null,
      role: d?.position ? (d.position <= 3 ? 1 : 2) : 0,
      teamId: m.team,
      lastMatch: null,
      locked: false,
      profile: null,
    });
  }
  // Still nobody: STRATZ's members of the team who played in its last two weeks of matches.
  const stillMissing = missing.filter((t) => !accounts.some((a) => a.teamId === t.id));
  for (let i = 0; i < stillMissing.length; i += 10) {
    const chunk = stillMissing.slice(i, i + 10);
    type Members = {
      members: {
        steamAccountId: number;
        lastMatchDateTime: number | null;
        steamAccount: {
          name: string | null;
          avatar: string | null;
          proSteamAccount: { name: string | null; position: string | null } | null;
        } | null;
      }[];
    } | null;
    const data = await stratzQuery<Record<string, Members>>(
      `{ ${chunk
        .map(
          (t) =>
            `t${t.id}: team(teamId: ${t.id}) { members { steamAccountId lastMatchDateTime steamAccount { name avatar proSteamAccount { name position } } } }`,
        )
        .join(" ")} }`,
      20_000,
    ).catch(() => null);
    for (const t of chunk) {
      const members = (data?.[`t${t.id}`]?.members ?? [])
        .filter((m) => (m.lastMatchDateTime ?? 0) >= t.lastMatch - 14 * 86400)
        .sort((a, b) => (b.lastMatchDateTime ?? 0) - (a.lastMatchDateTime ?? 0))
        .slice(0, 5);
      for (const m of members) {
        const s = m.steamAccount;
        const position = Number(s?.proSteamAccount?.position?.replace("POSITION_", ""));
        accounts.push({
          accountId: m.steamAccountId,
          steamId: null,
          name: (clean(s?.proSteamAccount?.name) ?? clean(s?.name) ?? String(m.steamAccountId)).trim(),
          persona: clean(s?.name),
          avatar: clean(s?.avatar),
          country: null,
          role: position >= 1 && position <= 5 ? (position <= 3 ? 1 : 2) : 0,
          teamId: t.id,
          lastMatch: m.lastMatchDateTime,
          locked: false,
          profile: null,
        });
      }
    }
  }
  return { teams: active, players: groupPlayers(accounts), at: Date.now() };
}

// ── A team's page ────────────────────────────────────────────────────────────────────────────

export type TeamMember = {
  accountId: number;
  name: string;
  games: number;
  wins: number;
  current: boolean;
};

export type TeamMatch = {
  matchId: number;
  start: number;
  duration: number;
  won: boolean;
  radiant: boolean;
  score: [number, number];
  league: string | null;
  leagueId: number;
  opponentId: number | null;
  opponent: string | null;
  opponentLogo: string | null;
};

export type TeamHero = { heroId: number; games: number; wins: number };

export type TeamPage = {
  team: Omit<ProTeam, "rank">;
  members: TeamMember[];
  matches: TeamMatch[];
  heroes: TeamHero[];
  at: number;
};

export async function getTeamPage(teamId: number): Promise<TeamPage | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 7 * 24 * 3600 });
  const id = Math.trunc(teamId);
  const team = await getJson<RawTeam | null>(`${OPENDOTA}/teams/${id}`, { notFound: "null" });
  if (!team?.team_id) return null;
  type RawMember = {
    account_id: number;
    name: string | null;
    games_played: number;
    wins: number;
    is_current_team_member: boolean | null;
  };
  type RawMatch = {
    match_id: number;
    radiant_win: boolean;
    radiant_score: number;
    dire_score: number;
    radiant: boolean;
    duration: number;
    start_time: number;
    leagueid: number;
    league_name: string | null;
    opposing_team_id: number | null;
    opposing_team_name: string | null;
    opposing_team_logo: string | null;
  };
  type RawHero = { hero_id: number; games_played: number; wins: number };
  const [members, matches, heroes] = await Promise.all([
    getJson<RawMember[]>(`${OPENDOTA}/teams/${id}/players`).catch(() => [] as RawMember[]),
    getJson<RawMatch[]>(`${OPENDOTA}/teams/${id}/matches`).catch(() => [] as RawMatch[]),
    getJson<RawHero[]>(`${OPENDOTA}/teams/${id}/heroes`).catch(() => [] as RawHero[]),
  ]);
  return {
    team: {
      id: team.team_id,
      name: (team.name ?? String(id)).trim(),
      tag: (team.tag ?? "").trim(),
      logo: team.logo_url || null,
      rating: team.rating,
      wins: team.wins,
      losses: team.losses,
      lastMatch: team.last_match_time,
    },
    members: members
      .filter((m) => m.games_played > 0)
      .map((m) => ({
        accountId: m.account_id,
        name: (m.name ?? String(m.account_id)).trim(),
        games: m.games_played,
        wins: m.wins,
        current: !!m.is_current_team_member,
      })),
    // The newest year and a bit is plenty for the page.
    matches: matches
      .sort((a, b) => b.start_time - a.start_time)
      .slice(0, 400)
      .map((m) => ({
        matchId: m.match_id,
        start: m.start_time,
        duration: m.duration,
        won: m.radiant === m.radiant_win,
        radiant: m.radiant,
        score: m.radiant ? [m.radiant_score, m.dire_score] : [m.dire_score, m.radiant_score],
        league: m.league_name,
        leagueId: m.leagueid,
        opponentId: m.opposing_team_id,
        opponent: m.opposing_team_name,
        opponentLogo: m.opposing_team_logo,
      })),
    heroes: heroes
      .map((h) => ({ heroId: h.hero_id, games: h.games_played, wins: h.wins }))
      .filter((h) => h.games > 0)
      .sort((a, b) => b.games - a.games),
    at: Date.now(),
  };
}

// ── What STRATZ adds about a player ──────────────────────────────────────────────────────────

export type ProDetails = {
  persona: string | null;
  avatar: string | null;
  // The name STRATZ knows the pro by (it can differ from OpenDota's and PandaScore's).
  proName: string | null;
  realName: string | null;
  // 1–5, null when STRATZ doesn't say.
  position: number | null;
  sponsor: string | null;
  twitch: string | null;
  twitter: string | null;
  // rank_tier (medal × 10 + stars) and the leaderboard place, when in it.
  seasonRank: number | null;
  leaderboardRank: number | null;
  anonymous: boolean;
};

type RawDetails = {
  steamAccount: {
    name: string | null;
    avatar: string | null;
    seasonRank: number | null;
    seasonLeaderboardRank: number | null;
    isAnonymous: boolean | null;
    proSteamAccount: {
      name: string | null;
      realName: string | null;
      position: string | null;
      sponsor: string | null;
      twitchLink: string | null;
      twitterLink: string | null;
    } | null;
  } | null;
} | null;

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

// Ten players a request (aliases), so a roster or a compare costs one or two calls.
export async function getProDetails(accountIds: number[]): Promise<Record<number, ProDetails>> {
  "use cache";
  cacheLife("hours");
  const ids = [...new Set(accountIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  const out: Record<number, ProDetails> = {};
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const query = chunk
      .map(
        (id) =>
          `a${id}: player(steamAccountId: ${id}) { steamAccount { name avatar seasonRank seasonLeaderboardRank isAnonymous proSteamAccount { name realName position sponsor twitchLink twitterLink } } }`,
      )
      .join(" ");
    const data = await stratzQuery<Record<string, RawDetails>>(`{ ${query} }`, 20_000).catch(() => null);
    for (const id of chunk) {
      const s = data?.[`a${id}`]?.steamAccount;
      if (!s) continue;
      const pro = s.proSteamAccount;
      const position = Number(pro?.position?.replace("POSITION_", ""));
      out[id] = {
        persona: clean(s.name),
        avatar: clean(s.avatar),
        proName: clean(pro?.name),
        realName: clean(pro?.realName),
        position: position >= 1 && position <= 5 ? position : null,
        sponsor: clean(pro?.sponsor),
        twitch: clean(pro?.twitchLink),
        twitter: clean(pro?.twitterLink),
        seasonRank: s.seasonRank || null,
        leaderboardRank: s.seasonLeaderboardRank || null,
        anonymous: !!s.isAnonymous,
      };
    }
  }
  return out;
}

// ── Pros playing right now ───────────────────────────────────────────────────────────────────

export type LivePlayer = {
  accountId: number;
  heroId: number;
  radiant: boolean;
  name: string | null;
  teamName: string | null;
  pro: boolean;
};

export type LiveGame = {
  matchId: string;
  gameTime: number;
  radiantScore: number;
  direScore: number;
  radiantLead: number;
  averageMmr: number | null;
  leagueId: number;
  spectators: number;
  radiantTeam: string | null;
  direTeam: string | null;
  players: LivePlayer[];
  updated: number;
};

// OpenDota's top live games (the ones Valve lists) that have a pro in them.
export async function getLivePros(): Promise<{ games: LiveGame[]; at: number }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  type Raw = {
    match_id: string;
    game_time: number;
    radiant_score: number;
    dire_score: number;
    radiant_lead: number;
    average_mmr: number | null;
    league_id: number;
    spectators: number;
    team_name_radiant: string | null;
    team_name_dire: string | null;
    last_update_time: number;
    sort_score: number;
    players?: {
      account_id: number;
      hero_id: number;
      team: number;
      name?: string;
      team_name?: string;
      is_pro?: boolean;
    }[];
  };
  const live = await getJson<Raw[]>(`${OPENDOTA}/live`);
  const games = live
    .filter((g) => g.players?.some((p) => p.is_pro))
    .sort((a, b) => b.sort_score - a.sort_score)
    .map((g) => ({
      matchId: g.match_id,
      gameTime: g.game_time,
      radiantScore: g.radiant_score,
      direScore: g.dire_score,
      radiantLead: g.radiant_lead,
      averageMmr: g.average_mmr || null,
      leagueId: g.league_id,
      spectators: g.spectators,
      radiantTeam: clean(g.team_name_radiant),
      direTeam: clean(g.team_name_dire),
      updated: g.last_update_time,
      players: (g.players ?? []).map((p) => ({
        accountId: p.account_id,
        heroId: p.hero_id,
        radiant: p.team === 0,
        name: clean(p.name),
        teamName: clean(p.team_name),
        pro: !!p.is_pro,
      })),
    }));
  return { games, at: Date.now() };
}
