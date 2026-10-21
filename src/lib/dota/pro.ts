import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getJson } from "./data";
import { keep, kept } from "./kept";
import { findPsTeam, getPsRanking } from "./pandascore";
import { stratzQuery } from "./stratz";

// The pro scene for GOAT: OpenDota's team ratings, its register of pro accounts (who plays for which
// team, with every known account of a player) and team pages; STRATZ adds what OpenDota lacks about
// a player (real name, position, sponsor, links, the season rank and leaderboard place). All of it
// is cached and refetched in the background, so the teams and rosters keep themselves up to date.
// When OpenDota is down, the last good answer kept in the database stands in; with none kept, the
// scene and team pages are put together from PandaScore's results and STRATZ.

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
  // OpenDota's rating; null when the data came from elsewhere.
  rating: number | null;
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

// Where the data came from: OpenDota now, what OpenDota last gave (kept), or the stand-in.
export type ProSource = "opendota" | "kept" | "fallback";

export type ProScene = { teams: ProTeam[]; players: ProPlayer[]; at: number; source: ProSource };

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
  try {
    const scene = await openDotaScene();
    cacheLife({ stale: 60, revalidate: 6 * 3600, expire: 7 * 24 * 3600 });
    await keep("pro-scene", scene).catch(() => {});
    return scene;
  } catch {
    // Tried again in a quarter of an hour.
    cacheLife({ stale: 60, revalidate: 900, expire: 7 * 24 * 3600 });
    const last = await kept<ProScene>("pro-scene").catch(() => null);
    if (last) return { ...last.data, source: "kept" };
    return fallbackScene();
  }
}

async function openDotaScene(): Promise<ProScene> {
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
  // An empty answer is OpenDota failing, not a scene to keep.
  if (!active.length) throw new Error("no active teams");
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
  accounts.push(...(await stratzMembers(stillMissing, new Set(accounts.map((a) => a.accountId)))));
  return { teams: active, players: groupPlayers(accounts), at: Date.now(), source: "opendota" };
}

// The members STRATZ has for each team who played in its last two weeks of matches (up to five,
// the latest first), ten teams a request. Not someone in `taken` (already on another team): an
// old team keeps its members on STRATZ after a roster moves on (TEAM VISION's became PARIVISION's).
async function stratzMembers(teams: { id: number; lastMatch: number }[], taken: Set<number>) {
  const accounts: ProAccount[] = [];
  for (let i = 0; i < teams.length; i += 10) {
    const chunk = teams.slice(i, i + 10);
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
        .filter((m) => (m.lastMatchDateTime ?? 0) >= t.lastMatch - 14 * 86400 && !taken.has(m.steamAccountId))
        .sort((a, b) => (b.lastMatchDateTime ?? 0) - (a.lastMatchDateTime ?? 0))
        .slice(0, 5);
      for (const m of members) {
        const s = m.steamAccount;
        const position = Number(s?.proSteamAccount?.position?.replace("POSITION_", ""));
        taken.add(m.steamAccountId);
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
  return accounts;
}

type StratzTeam = {
  id: number;
  name: string | null;
  tag: string | null;
  logo: string | null;
  winCount: number | null;
  lossCount: number | null;
  lastMatchDateTime: number | null;
};

// The stand-in scene: the teams PandaScore saw win the most in big tournaments lately, found on
// STRATZ by name (its team ids are OpenDota's), with their members there. No ratings, no free agents.
async function fallbackScene(): Promise<ProScene> {
  const ranking = (await getPsRanking()).slice(0, TOP_TEAMS);
  const teams: ProTeam[] = [];
  for (let i = 0; i < ranking.length; i += 10) {
    const chunk = ranking.slice(i, i + 10);
    type Found = Record<string, { search: { teams: StratzTeam[] | null } | null } | null>;
    const data = await stratzQuery<Found>(
      `{ ${chunk
        .map(
          (r, k) =>
            `s${k}: stratz { search(request: { query: ${JSON.stringify(r.name)}, searchType: [TEAMS], take: 5 }) { teams { id name tag logo winCount lossCount lastMatchDateTime } } }`,
        )
        .join(" ")} }`,
      20_000,
    );
    chunk.forEach((r, k) => {
      const found = (data[`s${k}`]?.search?.teams ?? [])
        .filter((x) => x.name)
        .map((x) => ({ ...x, name: x.name!.trim(), acronym: x.tag }));
      const team = findPsTeam(found, r.name, r.acronym);
      if (!team || teams.some((x) => x.id === team.id)) return;
      teams.push({
        id: team.id,
        name: team.name,
        tag: (team.tag ?? "").trim(),
        logo: clean(team.logo),
        rating: null,
        wins: team.winCount ?? 0,
        losses: team.lossCount ?? 0,
        lastMatch: team.lastMatchDateTime ?? 0,
        rank: teams.length + 1,
      });
    });
  }
  if (!teams.length) throw new Error("no stand-in scene");
  const accounts = await stratzMembers(teams, new Set());
  return { teams, players: groupPlayers(accounts), at: Date.now(), source: "fallback" };
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
  source: ProSource;
};

export async function getTeamPage(teamId: number): Promise<TeamPage | null> {
  "use cache";
  const id = Math.trunc(teamId);
  try {
    const page = await openDotaTeamPage(id);
    cacheLife({ stale: 60, revalidate: 3600, expire: 7 * 24 * 3600 });
    if (page) await keep(`team:${id}`, page).catch(() => {});
    return page;
  } catch {
    cacheLife({ stale: 60, revalidate: 900, expire: 7 * 24 * 3600 });
    const last = await kept<TeamPage>(`team:${id}`).catch(() => null);
    if (last) return { ...last.data, source: "kept" };
    return stratzTeamPage(id);
  }
}

// All of it or nothing: a page missing its matches isn't one to keep.
async function openDotaTeamPage(id: number): Promise<TeamPage | null> {
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
    getJson<RawMember[]>(`${OPENDOTA}/teams/${id}/players`),
    getJson<RawMatch[]>(`${OPENDOTA}/teams/${id}/matches`),
    getJson<RawHero[]>(`${OPENDOTA}/teams/${id}/heroes`),
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
    source: "opendota",
  };
}

// The stand-in team page from STRATZ: the team, its last hundred matches, and the members and
// heroes counted from those (OpenDota counts all of the team's matches).
async function stratzTeamPage(id: number): Promise<TeamPage | null> {
  type Side = { id: number; name: string | null; logo: string | null } | null;
  type Raw = {
    team:
      | (StratzTeam & {
          members: {
            steamAccountId: number;
            lastMatchDateTime: number | null;
            steamAccount: { name: string | null; proSteamAccount: { name: string | null } | null } | null;
          }[];
          matches: {
            id: number;
            didRadiantWin: boolean | null;
            durationSeconds: number | null;
            startDateTime: number;
            radiantTeamId: number | null;
            radiantTeam: Side;
            direTeam: Side;
            league: { id: number; displayName: string | null } | null;
            radiantKills: number[] | null;
            direKills: number[] | null;
            players: { isRadiant: boolean; heroId: number; steamAccountId: number }[] | null;
          }[];
        })
      | null;
  };
  const data = await stratzQuery<Raw>(
    `{ team(teamId: ${id}) { id name tag logo winCount lossCount lastMatchDateTime members(take: 40) { steamAccountId lastMatchDateTime steamAccount { name proSteamAccount { name } } } matches(request: { take: 100, skip: 0 }) { id didRadiantWin durationSeconds startDateTime radiantTeamId radiantTeam { id name logo } direTeam { id name logo } league { id displayName } radiantKills direKills players { isRadiant heroId steamAccountId } } } }`,
    20_000,
  );
  const team = data.team;
  if (!team?.id) return null;
  const lastMatch = team.lastMatchDateTime ?? 0;
  const sum = (kills: number[] | null) => (kills ?? []).reduce((a, b) => a + b, 0);
  const games = new Map<number, { games: number; wins: number }>();
  const heroes = new Map<number, TeamHero>();
  const matches: TeamMatch[] = team.matches.map((m) => {
    const radiant = m.radiantTeamId === id;
    const won = radiant === !!m.didRadiantWin;
    for (const p of m.players ?? []) {
      if (p.isRadiant !== radiant) continue;
      const g = games.get(p.steamAccountId) ?? { games: 0, wins: 0 };
      games.set(p.steamAccountId, { games: g.games + 1, wins: g.wins + Number(won) });
      const h = heroes.get(p.heroId) ?? { heroId: p.heroId, games: 0, wins: 0 };
      heroes.set(p.heroId, { ...h, games: h.games + 1, wins: h.wins + Number(won) });
    }
    const opponent = radiant ? m.direTeam : m.radiantTeam;
    const [ours, theirs] = radiant ? [m.radiantKills, m.direKills] : [m.direKills, m.radiantKills];
    return {
      matchId: m.id,
      start: m.startDateTime,
      duration: m.durationSeconds ?? 0,
      won,
      radiant,
      score: [sum(ours), sum(theirs)],
      league: clean(m.league?.displayName),
      leagueId: m.league?.id ?? 0,
      opponentId: opponent?.id ?? null,
      opponent: clean(opponent?.name),
      opponentLogo: clean(opponent?.logo),
    };
  });
  return {
    team: {
      id: team.id,
      name: (team.name ?? String(id)).trim(),
      tag: (team.tag ?? "").trim(),
      logo: clean(team.logo),
      rating: null,
      wins: team.winCount ?? 0,
      losses: team.lossCount ?? 0,
      lastMatch,
    },
    members: team.members
      .map((m) => ({
        accountId: m.steamAccountId,
        name: (
          clean(m.steamAccount?.proSteamAccount?.name) ??
          clean(m.steamAccount?.name) ??
          String(m.steamAccountId)
        ).trim(),
        ...(games.get(m.steamAccountId) ?? { games: 0, wins: 0 }),
        current: (m.lastMatchDateTime ?? 0) >= lastMatch - 14 * 86400,
      }))
      .filter((m) => m.games > 0 || m.current),
    matches: matches.sort((a, b) => b.start - a.start),
    heroes: [...heroes.values()].sort((a, b) => b.games - a.games),
    at: Date.now(),
    source: "fallback",
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
  // The live page's refresh button expires it early (goat/live/actions.ts).
  cacheTag("goat-live");
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
    // OpenDota keeps games in the list for a while after they stop updating (ended or dropped):
    // only the ones updated in the last 10 minutes.
    .filter((g) => g.players?.some((p) => p.is_pro) && g.last_update_time >= Date.now() / 1000 - 600)
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

// How much an account plays: STRATZ's match count and last match (any lobby), ten a request. For
// the 传奇 page: who still plays, and since when nobody has seen them.
export async function getAccountActivity(
  accountIds: number[],
): Promise<Record<number, { matches: number | null; lastMatch: number | null }>> {
  "use cache";
  cacheLife("hours");
  const ids = [...new Set(accountIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  const out: Record<number, { matches: number | null; lastMatch: number | null }> = {};
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    // The newest match itself: STRATZ's lastMatchDate is empty for many accounts.
    type Raw = { matchCount: number | null; matches: { startDateTime: number | null }[] | null } | null;
    const data = await stratzQuery<Record<string, Raw>>(
      `{ ${chunk
        .map(
          (id) =>
            `a${id}: player(steamAccountId: ${id}) { matchCount matches(request: { take: 1 }) { startDateTime } }`,
        )
        .join(" ")} }`,
      20_000,
    ).catch(() => null);
    for (const id of chunk) {
      const p = data?.[`a${id}`];
      if (p) out[id] = { matches: p.matchCount ?? null, lastMatch: p.matches?.[0]?.startDateTime ?? null };
    }
  }
  return out;
}
