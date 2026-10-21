import "server-only";
import { cacheLife } from "next/cache";

// PandaScore (esports data; PANDASCORE_API_TOKEN, about 1000 requests an hour on our plan): the
// hand-kept rosters (photo, real name, age, nationality, role) and the schedule (series, tournament
// tier, streams). It has no Steam accounts, so GOAT ties it to OpenDota by team and player names.

const BASE = "https://api.pandascore.co";

async function ps<T>(path: string): Promise<T> {
  const token = process.env.PANDASCORE_API_TOKEN;
  if (!token) throw new Error("PANDASCORE_API_TOKEN is not set");
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PandaScore ${response.status}`);
  return (await response.json()) as T;
}

export const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
// Without the words teams add and drop (Team Falcons / Falcons, Aurora Gaming / Aurora).
const core = (s: string | null | undefined) =>
  norm((s ?? "").replace(/\b(team|gaming|esports?|e-sports|club|org)\b/gi, ""));

export type PsPlayer = {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  birthday: string | null;
  age: number | null;
  // 1–5 when PandaScore knows.
  role: number | null;
  photo: string | null;
};

export type PsTeam = {
  id: number;
  name: string;
  acronym: string | null;
  slug: string;
  location: string | null;
  image: string | null;
  players: PsPlayer[];
};

type RawPlayer = {
  id: number;
  name: string;
  active?: boolean;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  nationality: string | null;
  birthday: string | null;
  age?: number | null;
  image_url: string | null;
};

type RawTeam = {
  id: number;
  name: string;
  acronym: string | null;
  slug: string;
  location: string | null;
  image_url: string | null;
  players?: RawPlayer[];
};

const trim = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

function player(p: RawPlayer): PsPlayer {
  const role = Number(p.role);
  return {
    id: p.id,
    name: p.name.trim(),
    firstName: trim(p.first_name),
    lastName: trim(p.last_name),
    nationality: trim(p.nationality)?.toLowerCase() ?? null,
    birthday: trim(p.birthday),
    age: p.age ?? null,
    role: role >= 1 && role <= 5 ? role : null,
    photo: trim(p.image_url),
  };
}

function team(t: RawTeam): PsTeam {
  return {
    id: t.id,
    name: t.name.trim(),
    acronym: trim(t.acronym),
    slug: t.slug,
    location: trim(t.location)?.toLowerCase() ?? null,
    image: trim(t.image_url),
    players: (t.players ?? []).filter((p) => p.active !== false).map(player),
  };
}

// ── Matches ──────────────────────────────────────────────────────────────────────────────────

export type PsMatch = {
  id: number;
  status: "running" | "not_started" | "finished" | "canceled" | "postponed";
  begin: string | null;
  end: string | null;
  bestOf: number;
  opponents: {
    id: number;
    name: string;
    acronym: string | null;
    image: string | null;
    score: number | null;
  }[];
  winnerId: number | null;
  league: { name: string; image: string | null };
  serie: string | null;
  tournament: string | null;
  tier: string | null;
  streams: { language: string; url: string; main: boolean; official: boolean }[];
};

type RawMatch = {
  id: number;
  status: PsMatch["status"];
  begin_at: string | null;
  scheduled_at: string | null;
  end_at: string | null;
  number_of_games: number;
  winner_id: number | null;
  opponents?: { opponent: { id: number; name: string; acronym: string | null; image_url: string | null } }[];
  results?: { team_id: number; score: number }[];
  league?: { name: string; image_url: string | null } | null;
  serie?: { full_name: string | null; name: string | null } | null;
  tournament?: { name: string | null; tier: string | null } | null;
  streams_list?: { language: string; raw_url: string; main: boolean; official: boolean }[];
};

function match(m: RawMatch): PsMatch {
  return {
    id: m.id,
    status: m.status,
    begin: m.begin_at ?? m.scheduled_at,
    end: m.end_at,
    bestOf: m.number_of_games,
    opponents: (m.opponents ?? []).map(({ opponent: o }) => ({
      id: o.id,
      name: o.name.trim(),
      acronym: trim(o.acronym),
      image: trim(o.image_url),
      score: m.results?.find((r) => r.team_id === o.id)?.score ?? null,
    })),
    winnerId: m.winner_id,
    league: { name: m.league?.name ?? "", image: trim(m.league?.image_url) },
    serie: trim(m.serie?.full_name) ?? trim(m.serie?.name),
    tournament: trim(m.tournament?.name),
    tier: trim(m.tournament?.tier)?.toUpperCase() ?? null,
    streams: (m.streams_list ?? [])
      .filter((s) => s.raw_url)
      .sort((a, b) => Number(b.main) - Number(a.main) || Number(b.official) - Number(a.official))
      .map((s) => ({ language: s.language, url: s.raw_url, main: s.main, official: s.official })),
  };
}

export type PsSchedule = { running: PsMatch[]; upcoming: PsMatch[]; past: PsMatch[]; at: number };

// What's on: series being played, the next ones, and the last week's results.
export async function getPsSchedule(): Promise<PsSchedule> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 300, expire: 24 * 3600 });
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
  const [running, upcoming, past] = await Promise.all([
    ps<RawMatch[]>("/dota2/matches/running?per_page=50"),
    ps<RawMatch[]>("/dota2/matches/upcoming?per_page=100&sort=begin_at"),
    ps<RawMatch[]>(
      `/dota2/matches/past?per_page=100&sort=-begin_at&range[begin_at]=${week},${now.toISOString()}`,
    ),
  ]);
  return {
    running: running.map(match),
    upcoming: upcoming.map(match).filter((m) => m.opponents.length === 2),
    past: past.map(match).filter((m) => m.status === "finished"),
    at: Date.now(),
  };
}

// One team's next series and its latest results.
export async function getPsTeamMatches(teamId: number): Promise<{ upcoming: PsMatch[]; past: PsMatch[] }> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 24 * 3600 });
  const id = Math.trunc(teamId);
  const [upcoming, past] = await Promise.all([
    ps<RawMatch[]>(`/dota2/matches/upcoming?per_page=10&sort=begin_at&filter[opponent_id]=${id}`),
    ps<RawMatch[]>(`/dota2/matches/past?per_page=15&sort=-begin_at&filter[opponent_id]=${id}`),
  ]);
  return { upcoming: upcoming.map(match), past: past.map(match).filter((m) => m.status === "finished") };
}

// ── Teams ────────────────────────────────────────────────────────────────────────────────────

// The teams that played in the last 120 days or have a series coming, with their rosters; then the
// names given (OpenDota's active teams) that still have no counterpart, looked up one by one.
export async function getPsTeams(names: string[]): Promise<{ teams: PsTeam[]; at: number }> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 6 * 3600, expire: 7 * 24 * 3600 });
  const now = new Date();
  const since = new Date(now.getTime() - 120 * 86400 * 1000).toISOString();
  const ids = new Set<number>();
  for (let page = 1; page <= 5; page++) {
    const past = await ps<RawMatch[]>(
      `/dota2/matches/past?per_page=100&page=${page}&sort=-begin_at&range[begin_at]=${since},${now.toISOString()}`,
    );
    for (const m of past) for (const o of m.opponents ?? []) ids.add(o.opponent.id);
    if (past.length < 100) break;
  }
  const upcoming = await ps<RawMatch[]>("/dota2/matches/upcoming?per_page=100");
  for (const m of upcoming) for (const o of m.opponents ?? []) ids.add(o.opponent.id);
  const list = [...ids];
  const teams: PsTeam[] = [];
  for (let i = 0; i < list.length; i += 100)
    teams.push(
      ...(
        await ps<RawTeam[]>(`/dota2/teams?per_page=100&filter[id]=${list.slice(i, i + 100).join(",")}`)
      ).map(team),
    );
  const missing = names.filter((n) => !findPsTeam(teams, n, null)).slice(0, 30);
  for (const name of missing) {
    const found = await ps<RawTeam[]>(
      `/dota2/teams?per_page=5&search[name]=${encodeURIComponent(name.trim())}`,
    ).catch(() => []);
    for (const t of found) if (!teams.some((x) => x.id === t.id)) teams.push(team(t));
  }
  return { teams, at: Date.now() };
}

// OpenDota's team name (and tag) → PandaScore's team: the same name, the same name without
// "Team"/"Gaming"…, or the same acronym.
export function findPsTeam(teams: PsTeam[], name: string, tag: string | null) {
  const n = norm(name);
  const c = core(name);
  const t = norm(tag);
  return (
    teams.find((x) => norm(x.name) === n) ??
    (c.length >= 3 ? teams.find((x) => core(x.name) === c) : undefined) ??
    (t.length >= 2
      ? teams.find((x) => norm(x.acronym) === t && (core(x.name).startsWith(c.slice(0, 2)) || !c))
      : undefined)
  );
}

// A PandaScore player's name against an OpenDota name: the same, or one inside the other (Malady /
// Maladych, watson / 医者watson`) when both are long enough to mean it.
export function sameNick(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x));
}

// PandaScore's photos of players by name (retired ones too), one request for up to 50 names: the
// normalized name → the picture (the entry with a photo when a name has several).
export async function getPsPhotos(names: string[]): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  const out: Record<string, string> = {};
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    const list = await ps<RawPlayer[]>(
      `/dota2/players?per_page=100&filter[name]=${encodeURIComponent(chunk.join(","))}`,
    ).catch(() => [] as RawPlayer[]);
    for (const p of list) if (p.image_url && !out[norm(p.name)]) out[norm(p.name)] = p.image_url;
  }
  return out;
}
