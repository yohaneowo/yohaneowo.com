import "server-only";
import { getGuest, type GuestStatus } from "@/lib/dota/admin";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import type { DeathsSource } from "./deaths/deaths-view";

// Where a player's matches come from on their public pages: admin's history when they linked Steam
// here, admin's guest history once someone asked for it in full and a page of it is in, else STRATZ's
// newest 100. Also the guest's state, for the 读取全部 banner.
export async function sourceOf(
  accountId: number,
): Promise<{ source: DeathsSource; guest: GuestStatus | null }> {
  const userId = await getSteamOwner(steamIdOf(accountId));
  if (userId) return { source: { kind: "stored", userId }, guest: null };
  const guest = await getGuest(accountId).catch(() => null);
  return { source: guest && guest.read > 0 ? { kind: "guest" } : { kind: "stratz" }, guest };
}
