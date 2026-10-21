import "server-only";
import { cacheLife } from "next/cache";
import { z } from "zod";

// admin's website DotaHub API: the linked Steam account (admin checks its ranked matches in the
// background and queues the death-map DMs), the DM setting, and the stored deaths for the heat map.

export class DotaAdminUnavailable extends Error {}

// The stored matches (deaths, details, the bracket) are big and take admin seconds to put together,
// so they're cached: refetched in the background after two minutes, and an older copy is served
// at once meanwhile (for up to a week), so only the very first view of a player waits. A new match
// shows up on the view after it's stored. (Errors from a cached call reach the caller as plain
// Errors, which is all the callers expect.)
const STORED = { stale: 30, revalidate: 120, expire: 7 * 24 * 3600 };

function endpoint() {
  const base = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_MOVIES_TOKEN;
  if (!base || !token) throw new DotaAdminUnavailable("notConnected");
  return { base: `${base.replace(/\/+$/, "")}/api/v1/bot/website/dota`, token };
}

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const { base, token } = endpoint();
  let response: Response;
  try {
    response = await fetch(base + path, {
      method: init.method ?? "GET",
      headers: { "X-Movies-Token": token, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new DotaAdminUnavailable("unreachable");
  }
  if (response.status === 404) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new DotaAdminUnavailable(`HTTP ${response.status}`);
  return result.data;
}

const statusSchema = z.union([
  z.object({ linked: z.literal(false) }),
  z.object({
    linked: z.literal(true),
    accountId: z.number(),
    notify: z.boolean(),
    discordLinked: z.boolean(),
    historyDone: z.boolean(),
    historyRead: z.number(),
    stored: z.number(),
  }),
]);
export type DotaStatus = z.infer<typeof statusSchema>;

export const deathEventSchema = z.object({
  t: z.number(),
  x: z.number(),
  y: z.number(),
  by: z.number(),
  gold: z.number(),
  dead: z.number(),
  // This death was the match's first blood (missing on matches read before it was recorded).
  fb: z.boolean().optional(),
});
export type DeathEvent = z.infer<typeof deathEventSchema>;

const storedMatchSchema = z.object({
  matchId: z.number(),
  heroId: z.number(),
  won: z.boolean(),
  startTime: z.number(),
  duration: z.number(),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  imp: z.number().nullable(),
  parsed: z.boolean(),
  deathEvents: z.array(deathEventSchema),
});
export type StoredMatch = z.infer<typeof storedMatchSchema>;

const deathsSchema = z.object({ historyDone: z.boolean(), matches: z.array(storedMatchSchema) });

// A parsed match's economy and IMP: position 1–5, lane, STRATZ's award, GPM, XPM, final net worth,
// last hits, denies, hero damage; per minute the net worth (running total), IMP (at that minute)
// and last hits (that minute's); each item's first purchase as [seconds, item id].
export const matchDetailsSchema = z.object({
  pos: z.number().nullable(),
  lane: z.string().nullable(),
  award: z.string().nullable(),
  gpm: z.number(),
  xpm: z.number(),
  nw: z.number(),
  lh: z.number(),
  dn: z.number(),
  hd: z.number(),
  nwm: z.array(z.number()),
  impm: z.array(z.number()),
  lhm: z.array(z.number()),
  items: z.array(z.tuple([z.number(), z.number()])),
  // From the player's side (missing on matches read before these were kept): the team's net worth
  // lead and win chance (0–100) per minute, the lane outcome (-2 stomped … 2 stomped them),
  // STRATZ's read of the match, and the hero's average [net worth, last hits] at 10 / 20 / 30 min.
  rad: z.boolean().optional(),
  lead: z.array(z.number()).default([]),
  wp: z.array(z.number()).default([]),
  laneOut: z.number().nullable().default(null),
  outcome: z.string().nullable().default(null),
  bench: z
    .record(z.string(), z.tuple([z.number(), z.number()]))
    .nullable()
    .default(null),
});
export type MatchDetails = z.infer<typeof matchDetailsSchema>;

const detailMatchSchema = z.object({
  matchId: z.number(),
  heroId: z.number(),
  won: z.boolean(),
  startTime: z.number(),
  duration: z.number(),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  imp: z.number().nullable(),
  details: matchDetailsSchema,
});
// A match for the economy and IMP pages (no deaths; always with details).
export type DetailMatch = z.infer<typeof detailMatchSchema>;

const detailsListSchema = z.object({
  historyDone: z.boolean(),
  matches: z.array(detailMatchSchema.extend({ details: matchDetailsSchema.nullable() })),
});

export async function linkDota(
  userId: string,
  input: { steamId: string; accountId: number; discordId: string | null },
) {
  return statusSchema.parse(
    await call(`/users/${encodeURIComponent(userId)}/link`, { method: "PUT", body: input }),
  );
}

export async function unlinkDota(userId: string) {
  await call(`/users/${encodeURIComponent(userId)}/link`, { method: "DELETE" });
}

export async function getDotaStatus(userId: string, discordId: string | null) {
  const query = discordId ? `?discordId=${encodeURIComponent(discordId)}` : "";
  return statusSchema.parse(await call(`/users/${encodeURIComponent(userId)}${query}`));
}

export async function setDotaNotify(userId: string, notify: boolean) {
  return z
    .object({ notify: z.boolean() })
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/settings`, { method: "PUT", body: { notify } }));
}

// limit 0: every stored match.
// The stored ranked matches with details, newest first (limit 0: all of them); null when admin
// doesn't know the account.
export async function getStoredDetails(userId: string, limit: number) {
  "use cache";
  cacheLife(STORED);
  const data = detailsListSchema
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/details?limit=${limit}`));
  if (!data) return null;
  return {
    historyDone: data.historyDone,
    matches: data.matches.filter((m): m is DetailMatch => m.details !== null),
  };
}

const otherSchema = z.object({
  acc: z.number().nullable(),
  hero: z.number(),
  won: z.boolean(),
  rad: z.boolean(),
  pos: z.number().nullable(),
  laneOut: z.number().nullable(),
  gpm: z.number(),
  xpm: z.number(),
  lh: z.number(),
  imp: z.number().nullable(),
  nwm: z.array(z.number()),
  lhm: z.array(z.number()),
  items: z.array(z.tuple([z.number(), z.number()])),
});
const bracketSchema = z.object({
  matches: z.array(
    z.object({
      matchId: z.number(),
      startTime: z.number(),
      duration: z.number(),
      rad: z.boolean().nullable(),
      lead: z.array(z.number()),
      others: z.array(otherSchema),
    }),
  ),
});
export type BracketMatch = z.infer<typeof bracketSchema>["matches"][number];

// The other nine players of the stored ranked matches (the player's bracket), newest first
// (limit 0: all); null when admin doesn't know the account.
export async function getStoredBracket(userId: string, limit: number) {
  "use cache";
  cacheLife(STORED);
  return bracketSchema
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/bracket?limit=${limit}`));
}

export async function getStoredDeaths(userId: string, limit: number) {
  "use cache";
  cacheLife(STORED);
  return deathsSchema
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/deaths?limit=${limit}`));
}

const sampleSchema = z.object({
  count: z.number(),
  target: z.number(),
  filledAt: z.number().nullable(),
  matches: z.array(
    z.object({
      matchId: z.number(),
      heroId: z.number(),
      startTime: z.number(),
      duration: z.number(),
      won: z.boolean(),
      acc: z.number().nullable(),
      imp: z.number().nullable(),
      details: matchDetailsSchema,
    }),
  ),
});
export type RankSample = z.infer<typeof sampleSchema>;

// A hero's ranked matches at a rank tier (medal 1–8), newest first: admin collects them in the
// background while they're asked for, so this also keeps them collected. Short of target while
// it's still collecting.
export async function getRankSample(heroId: number, tier: number) {
  return sampleSchema
    .nullable()
    .parse(await call(`/samples/${Math.trunc(heroId)}/${Math.trunc(tier)}?limit=200`));
}

// ── Guests: the whole history of an account nobody linked, read on request ─────────────────────

const guestSchema = z.object({
  accountId: z.number(),
  state: z.enum(["queued", "reading", "done"]),
  // Unfinished guests asked for before this one (0: it's being read).
  ahead: z.number(),
  read: z.number(),
  historyDone: z.boolean(),
  requestedAt: z.number(),
  error: z.string().nullable(),
});
export type GuestStatus = z.infer<typeof guestSchema>;

// A signed-in user confirmed reading an account's whole ranked history: admin queues it (one guest
// at a time, a page a minute, a daily budget). "linked": the account is linked here already;
// "tooMany": the user has three waiting. keep: a pro, never dropped for going unseen (too many matches
// to read again).
export async function queueGuest(
  accountId: number,
  userId: string,
  keep: boolean,
): Promise<GuestStatus | "linked" | "tooMany"> {
  try {
    return guestSchema.parse(
      await call(`/guests/${Math.trunc(accountId)}`, { method: "POST", body: { requestedBy: userId, keep } }),
    );
  } catch (error) {
    if (error instanceof DotaAdminUnavailable && error.message === "HTTP 409") return "linked";
    if (error instanceof DotaAdminUnavailable && error.message === "HTTP 429") return "tooMany";
    throw error;
  }
}

// Where an account's guest history stands; null when nobody asked for it.
export async function getGuest(accountId: number) {
  return guestSchema.nullable().parse(await call(`/guests/${Math.trunc(accountId)}`));
}

// The guests a user asked for, newest first (the progress notifications).
export async function listGuests(userId: string) {
  return z.array(guestSchema).parse(await call(`/guests?requestedBy=${encodeURIComponent(userId)}`));
}

// A guest's stored matches, as a linked account's (deaths, or economy and IMP details; limit 0:
// all). Cached like those; asking also tells admin the guest is still looked at.
export async function getGuestDeaths(accountId: number, limit: number) {
  "use cache";
  cacheLife(STORED);
  return deathsSchema
    .nullable()
    .parse(await call(`/accounts/${Math.trunc(accountId)}/deaths?limit=${limit}`));
}

export async function getGuestDetails(accountId: number, limit: number) {
  "use cache";
  cacheLife(STORED);
  const data = detailsListSchema
    .nullable()
    .parse(await call(`/accounts/${Math.trunc(accountId)}/details?limit=${limit}`));
  if (!data) return null;
  return {
    historyDone: data.historyDone,
    matches: data.matches.filter((m): m is DetailMatch => m.details !== null),
  };
}
