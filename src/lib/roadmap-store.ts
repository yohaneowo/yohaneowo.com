import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roadmapSuggestion, roadmapSuggestionLike, roadmapVote } from "@/db/schema";
import {
  DECLINED_SUGGESTIONS,
  ROADMAP,
  ROADMAP_AREAS,
  roadmapItem,
  VOTABLE,
  type RoadmapArea,
} from "./roadmap";

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

// Votes for an item, or takes the vote back. Only items that may still be built take votes.
export async function toggleVote(userId: string, itemId: string) {
  const item = roadmapItem(itemId);
  if (!item || !VOTABLE.includes(item.status)) return null;
  const removed = await db
    .delete(roadmapVote)
    .where(and(eq(roadmapVote.userId, userId), eq(roadmapVote.itemId, itemId)))
    .returning({ itemId: roadmapVote.itemId });
  if (removed.length === 0) await db.insert(roadmapVote).values({ userId, itemId }).onConflictDoNothing();
  const [row] = await db.select({ votes: count() }).from(roadmapVote).where(eq(roadmapVote.itemId, itemId));
  return { voted: removed.length === 0, votes: row?.votes ?? 0 };
}

export type SuggestionStatus = "pending" | "accepted" | "declined";

// A suggestion's review, from the code: an item that lists it, or the declined list.
function reviewOf(id: string): {
  status: SuggestionStatus;
  itemId: string | null;
  reason: { zh: string; en: string } | null;
} {
  const item = ROADMAP.find((entry) => entry.suggestions?.includes(id));
  if (item) return { status: "accepted", itemId: item.id, reason: null };
  const declined = DECLINED_SUGGESTIONS.find((entry) => entry.id === id);
  if (declined) return { status: "declined", itemId: null, reason: declined.reason };
  return { status: "pending", itemId: null, reason: null };
}

export type Idea = {
  id: string;
  area: string;
  title: string;
  detail: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  mine: boolean;
  status: SuggestionStatus;
  itemId: string | null;
  reason: { zh: string; en: string } | null;
};

// The idea box: every suggestion (without who sent it), with its likes and review.
export async function listIdeas(userId: string | null): Promise<Idea[]> {
  const [rows, likes, liked] = await Promise.all([
    db.select().from(roadmapSuggestion).orderBy(desc(roadmapSuggestion.createdAt)),
    db
      .select({ id: roadmapSuggestionLike.suggestionId, likes: count() })
      .from(roadmapSuggestionLike)
      .groupBy(roadmapSuggestionLike.suggestionId),
    userId
      ? db
          .select({ id: roadmapSuggestionLike.suggestionId })
          .from(roadmapSuggestionLike)
          .where(eq(roadmapSuggestionLike.userId, userId))
      : Promise.resolve([]),
  ]);
  const likeCount = new Map(likes.map((row) => [row.id, row.likes]));
  const likedIds = new Set(liked.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    area: row.area,
    title: row.title,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    likes: likeCount.get(row.id) ?? 0,
    liked: likedIds.has(row.id),
    mine: row.userId === userId,
    ...reviewOf(row.id),
  }));
}

// Likes a suggestion still waiting for review, or takes the like back.
export async function toggleLike(userId: string, suggestionId: string) {
  const [found] = await db
    .select({ id: roadmapSuggestion.id })
    .from(roadmapSuggestion)
    .where(eq(roadmapSuggestion.id, suggestionId))
    .limit(1);
  if (!found || reviewOf(suggestionId).status !== "pending") return null;
  const removed = await db
    .delete(roadmapSuggestionLike)
    .where(
      and(eq(roadmapSuggestionLike.userId, userId), eq(roadmapSuggestionLike.suggestionId, suggestionId)),
    )
    .returning({ id: roadmapSuggestionLike.suggestionId });
  if (removed.length === 0)
    await db.insert(roadmapSuggestionLike).values({ userId, suggestionId }).onConflictDoNothing();
  const [row] = await db
    .select({ likes: count() })
    .from(roadmapSuggestionLike)
    .where(eq(roadmapSuggestionLike.suggestionId, suggestionId));
  return { liked: removed.length === 0, likes: row?.likes ?? 0 };
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
  const mine = await db
    .select({ id: roadmapSuggestion.id })
    .from(roadmapSuggestion)
    .where(eq(roadmapSuggestion.userId, userId));
  if (mine.filter((s) => reviewOf(s.id).status === "pending").length >= MAX_PENDING_SUGGESTIONS)
    return "tooMany";
  await db.insert(roadmapSuggestion).values({ id: randomUUID(), userId, area: input.area, title, detail });
  return null;
}
