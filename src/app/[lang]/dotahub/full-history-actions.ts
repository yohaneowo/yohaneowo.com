"use server";

import { type GuestStatus, listGuests, queueGuest } from "@/lib/dota/admin";
import { getPlayer } from "@/lib/dota/data";
import { getSession } from "@/lib/auth";

export type FullHistoryResult =
  { ok: true; status: GuestStatus } | { ok: false; error: "signIn" | "linked" | "tooMany" | "unavailable" };

// 读取全部 confirmed: queue the account's whole ranked history at admin, as the signed-in user.
export async function requestFullHistory(accountId: number): Promise<FullHistoryResult> {
  if (!Number.isInteger(accountId) || accountId <= 0) return { ok: false, error: "unavailable" };
  const session = await getSession();
  if (!session) return { ok: false, error: "signIn" };
  try {
    const result = await queueGuest(accountId, session.user.id);
    if (result === "linked" || result === "tooMany") return { ok: false, error: result };
    return { ok: true, status: result };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export type FullHistoryNotice = GuestStatus & { name: string; avatar: string | null };

// The signed-in user's requests, with names and faces, for the notifications (null: signed out).
export async function myFullHistory(): Promise<FullHistoryNotice[] | null> {
  const session = await getSession();
  if (!session) return null;
  const list = await listGuests(session.user.id).catch(() => []);
  return Promise.all(
    list.map(async (g) => {
      const player = await getPlayer(g.accountId).catch(() => null);
      const profile = player?.data.profile;
      return { ...g, name: profile?.personaname ?? String(g.accountId), avatar: profile?.avatarfull ?? null };
    }),
  );
}
