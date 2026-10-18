import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { bondCandidates, guildState } from "@/lib/discord-guilds";
import { getMovieBonds } from "@/lib/movies";
import type { BondsProp } from "@/app/[lang]/moviehub/bonds-card";

// 羁绊: accounts sharing a Discord server with this one, with the watch overlap admin computes.
// Null when admin can't answer, so the card simply stays away. refresh: false on someone else's
// page, which reads their stored server list instead of calling Discord with their token.
export async function loadBonds(userId: string, { refresh = true } = {}): Promise<BondsProp | null> {
  const guilds = await guildState(userId, { refresh });
  if (guilds.kind !== "ready") return { state: guilds.kind, rows: [] };
  const candidates = await bondCandidates(userId, guilds.guildIds);
  if (candidates.length === 0) return { state: "ready", rows: [] };
  try {
    const overlaps = await getMovieBonds(
      userId,
      candidates.map((candidate) => candidate.discordId),
    );
    const byDiscord = new Map(candidates.map((candidate) => [candidate.discordId, candidate]));
    return {
      state: "ready",
      rows: overlaps.flatMap((bond) => {
        const person = byDiscord.get(bond.discordId);
        return person ? [{ ...bond, userId: person.userId, name: person.name, image: person.image }] : [];
      }),
    };
  } catch (error) {
    console.warn("[bonds] admin bonds failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// A website account's public face: the name and avatar the bonds card shows.
export async function getSiteUser(userId: string) {
  const [found] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return found ?? null;
}
