import "server-only";
import { and, eq, like, lt, notLike, or } from "drizzle-orm";
import { db } from "@/db";
import { dotaSnapshot } from "@/db/schema";

// The last good answer kept in the database, for when the source is down and the cache is empty
// (after a deploy). Written on every good answer, read only when the source fails.

export async function keep(key: string, data: unknown) {
  await db
    .insert(dotaSnapshot)
    .values({ key, data })
    .onConflictDoUpdate({ target: dotaSnapshot.key, set: { data, updatedAt: new Date() } });
}

export async function kept<T>(key: string): Promise<{ data: T; at: number } | null> {
  const [row] = await db.select().from(dotaSnapshot).where(eq(dotaSnapshot.key, key)).limit(1);
  return row ? { data: row.data as T, at: row.updatedAt.getTime() } : null;
}

// Drops the rows under a prefix that are older than maxAge or were written by another version
// (keys `<prefix>:<version>:…`).
export async function dropKept(prefix: string, version: string, maxAge: number) {
  await db
    .delete(dotaSnapshot)
    .where(
      and(
        like(dotaSnapshot.key, `${prefix}:%`),
        or(
          notLike(dotaSnapshot.key, `${prefix}:${version}:%`),
          lt(dotaSnapshot.updatedAt, new Date(Date.now() - maxAge)),
        ),
      ),
    );
}
