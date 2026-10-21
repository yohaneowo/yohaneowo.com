import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RadioIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getHeroes, type HeroInfo } from "@/lib/dota/data";
import { getLivePros } from "@/lib/dota/pro";
import { ago, Notice } from "../../parts";
import { AutoRefresh } from "./auto-refresh";
import { LiveBoard } from "./live-board";
import { RefreshButton } from "./refresh-button";
import { LoadingPanel } from "../../loading-panel";

type T = Dictionary["dotahub"];

// How old the live data is, to the second while under a minute.
function age(at: number, t: T) {
  const seconds = Math.round((Date.now() - at) / 1000);
  return seconds < 60 ? t.goat.live.secondsAgo(Math.max(1, seconds)) : ago(at / 1000, t);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.live} · ${t.title}` };
}

async function Body({ t }: { t: T }) {
  await connection();
  const g = t.goat.live;
  const [live, heroes] = await Promise.all([
    getLivePros().catch(() => null),
    getHeroes().catch(() => ({}) as Record<number, HeroInfo>),
  ]);
  if (!live) return <Notice>{t.goat.unavailable}</Notice>;
  return (
    <div className="flex flex-col gap-3">
      {/* The refresh keeps the filter: it only reloads the games. */}
      <AutoRefresh seconds={60} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <RadioIcon className="size-4 animate-pulse text-red-500" aria-hidden />
            {g.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {g.hint} {g.refreshing}
          </p>
        </div>
        <RefreshButton updated={age(live.at, t)} />
      </div>
      <LiveBoard games={live.games} heroes={heroes} />
    </div>
  );
}

export default async function Page() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<LoadingPanel kind="goatLive" />}>
      <Body t={dict.dotahub} />
    </Suspense>
  );
}
