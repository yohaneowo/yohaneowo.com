import "server-only";
import { headers } from "next/headers";
import { after, connection } from "next/server";
import { getSession } from "@/lib/auth";
import { getGuestDeaths, getGuestDetails, getStoredDeaths, getStoredDetails } from "@/lib/dota/admin";
import { getHeroes, getItemCosts, getItems, getPeers, getRankedSides } from "@/lib/dota/data";
import { getHeroLevels, getPracticeHistory, getRankedHistory, getStratzRanked } from "@/lib/dota/stratz";
import type { DeathsSource } from "./deaths/deaths-view";

// Once a player's DotaHub page has gone out, fetch what their other pages need into the cache (the
// death map, economy, IMP, 绝活), so the next click finds it there instead of waiting seconds for
// admin and STRATZ. Calls already cached cost nothing; failures are ignored (the page will try).
// Only for signed-in visitors (and never for crawlers): the public pages are open to anyone, and
// a crawl of the pro players' pages, or a stranger paging through them, would otherwise cost
// several STRATZ and OpenDota calls a page out of the quotas shared with real users and admin.
// Signed out, the pages still work; the next one just takes a few seconds the first time.
const BOT =
  /bot|crawl|spider|slurp|scrapy|headless|python-requests|curl\/|wget\/|httpclient|facebookexternalhit/i;

export async function prewarm(accountId: number, source: DeathsSource) {
  // Only in a real request: while Next.js prerenders the page, after() would read the clock.
  await connection();
  if (BOT.test((await headers()).get("user-agent") ?? "")) return;
  if (!(await getSession().catch(() => null))) return;
  after(async () => {
    await Promise.allSettled([
      getHeroes(),
      getItems(),
      getItemCosts(),
      getRankedSides(accountId),
      getPeers(accountId),
      getRankedHistory(accountId),
      getHeroLevels(accountId),
      getPracticeHistory(accountId),
      // The death map's default range (rangeParam: 50) and the economy / IMP pages' full list.
      ...(source.kind === "stored"
        ? [getStoredDeaths(source.userId, 50), getStoredDetails(source.userId, 0)]
        : source.kind === "guest"
          ? [getGuestDeaths(accountId, 50), getGuestDetails(accountId, 0)]
          : [getStratzRanked(accountId)]),
    ]);
  });
}
