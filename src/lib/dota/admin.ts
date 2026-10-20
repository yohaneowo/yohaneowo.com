import "server-only";
import { z } from "zod";

// admin's website DotaHub API: the linked Steam account (admin checks its ranked matches in the
// background and queues the death-map DMs), the DM setting, and the stored deaths for the heat map.

export class DotaAdminUnavailable extends Error {}

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
  const data = detailsListSchema
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/details?limit=${limit}`));
  if (!data) return null;
  return {
    historyDone: data.historyDone,
    matches: data.matches.filter((m): m is DetailMatch => m.details !== null),
  };
}

export async function getStoredDeaths(userId: string, limit: number) {
  return deathsSchema
    .nullable()
    .parse(await call(`/users/${encodeURIComponent(userId)}/deaths?limit=${limit}`));
}
