import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { ROADMAP } from "@/lib/roadmap";
import { myVotes, voteCounts } from "@/lib/roadmap-store";
import { RoadmapBoard } from "./roadmap-board";
import { viewItem } from "./roadmap-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).roadmap.title };
}

// The board reads the session and the votes, so it renders under <Suspense>.
async function Board() {
  const lang = await getLocale();
  const session = await getSession();
  const [counts, mine] = await Promise.all([
    voteCounts(),
    session ? myVotes(session.user.id) : Promise.resolve([]),
  ]);
  return (
    <RoadmapBoard
      items={ROADMAP.map((item) => viewItem(item, lang))}
      counts={counts}
      mine={mine}
      signedIn={Boolean(session)}
    />
  );
}

export default async function RoadmapPage() {
  const t = (await getDictionary()).roadmap;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Board />
      </Suspense>
    </div>
  );
}
