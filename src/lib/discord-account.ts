import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";

export async function getDiscordAccount(userId: string) {
  const [linked] = await db
    .select({ id: account.id, accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
    .limit(1);
  return linked ?? null;
}

export async function hasOtherLogin(userId: string) {
  const accounts = await db
    .select({ provider: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return accounts.some((item) => item.provider !== "discord");
}
