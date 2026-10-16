import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { moviePreference } from "@/db/schema";
import { scoreSourceSchema, type ScoreSource } from "./movie-types";

export async function getScoreSource(userId: string): Promise<ScoreSource> {
  const [row] = await db
    .select({ scoreSource: moviePreference.scoreSource })
    .from(moviePreference)
    .where(eq(moviePreference.userId, userId))
    .limit(1);
  // An unknown stored value (e.g. a platform removed later) falls back to the default.
  return scoreSourceSchema.catch("imdb").parse(row?.scoreSource);
}

export async function setScoreSource(userId: string, scoreSource: ScoreSource) {
  await db
    .insert(moviePreference)
    .values({ userId, scoreSource })
    .onConflictDoUpdate({ target: moviePreference.userId, set: { scoreSource } });
}
