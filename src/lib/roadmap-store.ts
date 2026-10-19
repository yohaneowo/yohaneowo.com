import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roadmapSuggestion, roadmapVote } from "@/db/schema";
import { DECLINED_SUGGESTIONS, ROADMAP, ROADMAP_AREAS, roadmapItem, type RoadmapArea } from "./roadmap";

// Suggestions not yet reviewed, per account: more wait for the next roadmap update.
export const MAX_PENDING_SUGGESTIONS = 3;
export const SUGGESTION_TITLE_MAX = 60;
export const SUGGESTION_DETAIL_MAX = 500;

export async function voteCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ itemId: roadmapVote.itemId, votes: count() })
    .from(roadmapVote)
    .groupBy(roadmapVote.itemId);
  return Object.fromEntries(rows.map((row) => [row.itemId, row.votes]));
}

export async function myVotes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ itemId: roadmapVote.itemId })
    .from(roadmapVote)
    .where(eq(roadmapVote.userId, userId));
  return rows.map((row) => row.itemId);
}

// Votes for an item, or takes the vote back. Shipped items are closed. Returns the new state.
export async function toggleVote(userId: string, itemId: string) {
  const item = roadmapItem(itemId);
  if (!item || item.status === "shipped") return null;
  const removed = await db
    .delete(roadmapVote)
    .where(and(eq(roadmapVote.userId, userId), eq(roadmapVote.itemId, itemId)))
    .returning({ itemId: roadmapVote.itemId });
  if (removed.length === 0) await db.insert(roadmapVote).values({ userId, itemId }).onConflictDoNothing();
  const [row] = await db.select({ votes: count() }).from(roadmapVote).where(eq(roadmapVote.itemId, itemId));
  return { voted: removed.length === 0, votes: row?.votes ?? 0 };
}

export type SuggestionStatus = "pending" | "accepted" | "declined";

function statusOf(id: string): {
  status: SuggestionStatus;
  itemId?: string;
  reason?: { zh: string; en: string };
} {
  const item = ROADMAP.find((entry) => entry.suggestions?.includes(id));
  if (item) return { status: "accepted", itemId: item.id };
  const declined = DECLINED_SUGGESTIONS.find((entry) => entry.id === id);
  if (declined) return { status: "declined", reason: declined.reason };
  return { status: "pending" };
}

export async function mySuggestions(userId: string) {
  const rows = await db
    .select()
    .from(roadmapSuggestion)
    .where(eq(roadmapSuggestion.userId, userId))
    .orderBy(desc(roadmapSuggestion.createdAt));
  return rows.map((row) => ({
    id: row.id,
    area: row.area,
    title: row.title,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    ...statusOf(row.id),
  }));
}

export type SuggestionError = "badTitle" | "badDetail" | "badArea" | "tooMany";

export async function addSuggestion(
  userId: string,
  input: { area: string; title: string; detail: string },
): Promise<SuggestionError | null> {
  const title = input.title.trim();
  const detail = input.detail.trim();
  if (title.length < 2 || title.length > SUGGESTION_TITLE_MAX) return "badTitle";
  if (detail.length > SUGGESTION_DETAIL_MAX) return "badDetail";
  if (!ROADMAP_AREAS.includes(input.area as RoadmapArea)) return "badArea";
  const pending = (await mySuggestions(userId)).filter((s) => s.status === "pending").length;
  if (pending >= MAX_PENDING_SUGGESTIONS) return "tooMany";
  await db.insert(roadmapSuggestion).values({ id: randomUUID(), userId, area: input.area, title, detail });
  return null;
}
