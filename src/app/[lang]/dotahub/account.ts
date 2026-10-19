import "server-only";
import { redirect } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { type DotaStatus, getDotaStatus, linkDota } from "@/lib/dota/admin";
import { dotaAccountId, getSteamAccount } from "@/lib/steam-link";

// Whose Dota this page shows: signed out, not linked yet, or the linked account's Dota id.
export type DotaViewer =
  | { state: "signedOut" }
  | { state: "notLinked" }
  | { state: "linked"; accountId: number; steamId: string; userId: string };

export async function dotaViewer(): Promise<DotaViewer> {
  const session = await getSession();
  if (!session) return { state: "signedOut" };
  const steam = await getSteamAccount(session.user.id);
  if (!steam) return { state: "notLinked" };
  return {
    state: "linked",
    accountId: dotaAccountId(steam.steamId),
    steamId: steam.steamId,
    userId: session.user.id,
  };
}

// admin's side of the link (the background checks and DMs), linking it there when admin doesn't
// know it yet (a Steam account linked before, or a call that failed). Null when admin is down.
export async function syncDotaLink(
  viewer: Extract<DotaViewer, { state: "linked" }>,
): Promise<DotaStatus | null> {
  try {
    const discord = await getDiscordAccount(viewer.userId);
    const status = await getDotaStatus(viewer.userId, discord?.accountId ?? null);
    if (status.linked) return status;
    return await linkDota(viewer.userId, {
      steamId: viewer.steamId,
      accountId: viewer.accountId,
      discordId: discord?.accountId ?? null,
    });
  } catch {
    return null;
  }
}

// Someone's public page for the viewer's own account sends them to their own version of it
// (path: "/dotahub", "/dotahub/matches", …).
export async function redirectIfOwn(accountId: number, lang: Locale, path: string) {
  const viewer = await dotaViewer();
  if (viewer.state === "linked" && viewer.accountId === accountId) redirect(localePath(lang, path));
}
