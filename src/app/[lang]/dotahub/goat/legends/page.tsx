import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getLegendsView } from "@/lib/dota/goat";
import { MISSING } from "@/lib/dota/legends";
import { ago, Notice } from "../../parts";
import { LoadingPanel } from "../../loading-panel";
import { type LegendCard, LegendBoard } from "./legend-board";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.legends} · ${t.title}` };
}

// Played in the last month: still at it.
const RECENT = 30 * 86400;
const isRecent = (unix: number | null) => unix != null && Date.now() / 1000 - unix < RECENT;
// Past two months the month reads better than a count of days.
const longAgo = (unix: number) => Date.now() / 1000 - unix > 60 * 86400;
const month = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 7);

async function Body() {
  await connection();
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.dotahub;
  const l = t.goat.legends;
  const views = await getLegendsView().catch(() => null);
  if (!views) return <Notice>{t.goat.unavailable}</Notice>;
  const cards: LegendCard[] = views
    .map((v) => ({
      name: v.legend.name,
      real: v.legend.real,
      account: v.legend.accounts[0],
      era: v.era,
      ti: v.legend.ti,
      known: v.legend.known?.[lang] ?? null,
      team: v.team,
      photo: v.photo,
      persona: v.persona,
      seasonRank: v.seasonRank,
      leaderboardRank: v.leaderboardRank,
      matches: v.matches,
      lastPlayed: v.lastMatch ? (longAgo(v.lastMatch) ? month(v.lastMatch) : ago(v.lastMatch, t)) : null,
      recent: isRecent(v.lastMatch),
    }))
    // Oldest champions first; the icons last.
    .sort((a, b) => (a.ti[0]?.year ?? 9999) - (b.ti[0]?.year ?? 9999));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{l.hint}</p>
      <LegendBoard cards={cards} />
      <p className="text-xs text-muted-foreground">{l.missing(MISSING.join("、"))}</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingPanel kind="goatLegends" />}>
      <Body />
    </Suspense>
  );
}
