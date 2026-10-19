import "server-only";
import { getSession } from "@/lib/auth";
import { dotaAccountId, getSteamAccount } from "@/lib/steam-link";

// Whose Dota this page shows: signed out, not linked yet, or the linked account's Dota id.
export type DotaViewer =
  { state: "signedOut" } | { state: "notLinked" } | { state: "linked"; accountId: number; steamId: string };

export async function dotaViewer(): Promise<DotaViewer> {
  const session = await getSession();
  if (!session) return { state: "signedOut" };
  const steam = await getSteamAccount(session.user.id);
  if (!steam) return { state: "notLinked" };
  return { state: "linked", accountId: dotaAccountId(steam.steamId), steamId: steam.steamId };
}
