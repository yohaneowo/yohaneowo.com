import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RadioIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getHeroes, type HeroInfo } from "@/lib/dota/data";
import { getLivePros } from "@/lib/dota/pro";
import { Notice } from "../../parts";
import { AutoRefresh } from "./auto-refresh";
import { LiveBoard } from "./live-board";

type T = Dictionary["dotahub"];

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
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <RadioIcon className="size-4 animate-pulse text-red-500" aria-hidden />
          {g.title}
        </h2>
        <p className="text-xs text-muted-foreground">
          {g.hint} {g.refreshing}
        </p>
      </div>
      <LiveBoard games={live.games} heroes={heroes} />
    </div>
  );
}

export default async function Page() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Body t={dict.dotahub} />
    </Suspense>
  );
}
