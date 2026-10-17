import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { account, discordGuild, user } from "@/db/schema";
import { auth } from "@/lib/auth";

// 羁绊 needs to know which Discord servers people share. The list comes from Discord's
// /users/@me/guilds with the account's own token (the `guilds` OAuth scope) and lives in
// discord_guild; a stale list is refreshed when the movie page is opened.
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const DISCORD_API = "https://discord.com/api/v10";

export type GuildState =
  // Discord not linked to this account.
  | { kind: "unlinked" }
  // Linked before the `guilds` scope existed: the person has to authorize Discord again.
  | { kind: "reauthorize" }
  | { kind: "ready"; guildIds: string[] };

async function discordAccount(userId: string) {
  const [row] = await db
    .select({ id: account.id, accountId: account.accountId, scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
    .limit(1);
  return row ?? null;
}

async function storedGuilds(userId: string) {
  return db
    .select({ guildId: discordGuild.guildId, fetchedAt: discordGuild.fetchedAt })
    .from(discordGuild)
    .where(eq(discordGuild.userId, userId));
}

// The person's Discord servers, refreshed from Discord when the stored list is a day old. A
// failed refresh keeps the stored list (Discord down, token revoked…).
export async function guildState(userId: string): Promise<GuildState> {
  const linked = await discordAccount(userId);
  if (!linked) return { kind: "unlinked" };
  if (!(linked.scope ?? "").split(/[\s,]+/).includes("guilds")) return { kind: "reauthorize" };
  const stored = await storedGuilds(userId);
  const newest = stored.reduce((max, row) => Math.max(max, row.fetchedAt.getTime()), 0);
  if (stored.length && Date.now() - newest < REFRESH_AFTER_MS)
    return { kind: "ready", guildIds: stored.map((row) => row.guildId) };
  try {
    const fresh = await fetchGuildIds(userId, linked.id);
    await db.transaction(async (tx) => {
      await tx.delete(discordGuild).where(eq(discordGuild.userId, userId));
      if (fresh.length) await tx.insert(discordGuild).values(fresh.map((guildId) => ({ userId, guildId })));
    });
    return { kind: "ready", guildIds: fresh };
  } catch (error) {
    console.warn("[bonds] Discord guilds refresh failed:", error instanceof Error ? error.message : error);
    return { kind: "ready", guildIds: stored.map((row) => row.guildId) };
  }
}

async function fetchGuildIds(userId: string, accountRowId: string): Promise<string[]> {
  // Better Auth hands back a valid access token, refreshing it with Discord when it has expired
  // (accountId here is Better Auth's own account row id, not the Discord user id).
  const { accessToken } = await auth.api.getAccessToken({ body: { accountId: accountRowId, userId } });
  if (!accessToken) throw new Error("no Discord access token");
  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Discord answered HTTP ${response.status}`);
  const guilds = (await response.json()) as { id?: string }[];
  return guilds.map((guild) => guild.id).filter((id): id is string => typeof id === "string");
}

export type BondCandidate = {
  userId: string;
  discordId: string;
  name: string;
  image: string | null;
  sharedGuilds: number;
};

// Other accounts in at least one of these servers, with their Discord account id for admin.
export async function bondCandidates(userId: string, guildIds: string[]): Promise<BondCandidate[]> {
  if (guildIds.length === 0) return [];
  const rows = await db
    .select({
      userId: user.id,
      discordId: account.accountId,
      name: user.name,
      image: user.image,
      sharedGuilds: sql<number>`count(distinct ${discordGuild.guildId})`.mapWith(Number),
    })
    .from(discordGuild)
    .innerJoin(user, eq(user.id, discordGuild.userId))
    .innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "discord")))
    .where(and(inArray(discordGuild.guildId, guildIds), ne(discordGuild.userId, userId)))
    .groupBy(user.id, user.name, user.image, account.accountId);
  return rows;
}
