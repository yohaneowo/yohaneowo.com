import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { ROADMAP, roadmapItem } from "@/lib/roadmap";
import { myVotes, mySuggestions, voteCounts } from "@/lib/roadmap-store";
import { type BoardItem, RoadmapBoard } from "./roadmap-board";
import { SuggestionForm } from "./suggestion-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).roadmap.title };
}

// The board and the suggestions read the session and the votes, so they render under <Suspense>.
async function Roadmap() {
  const lang = await getLocale();
  const t = (await getDictionary()).roadmap;
  const session = await getSession();
  const [counts, mine, suggestions] = await Promise.all([
    voteCounts(),
    session ? myVotes(session.user.id) : Promise.resolve([]),
    session ? mySuggestions(session.user.id) : Promise.resolve([]),
  ]);
  const items: BoardItem[] = ROADMAP.map((item) => ({
    id: item.id,
    status: item.status,
    area: item.area,
    title: item.title[lang],
    detail: item.detail[lang],
    added: item.added,
    shipped: item.shipped ?? null,
  }));
  return (
    <>
      <RoadmapBoard items={items} counts={counts} mine={mine} signedIn={Boolean(session)} />

      <Card>
        <CardHeader>
          <CardTitle>{t.suggest.title}</CardTitle>
          <CardDescription>{t.suggest.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {session ? (
            <SuggestionForm />
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {t.suggest.signIn}
              <Link
                href={localePath(lang, "/login?next=/roadmap")}
                className={buttonVariants({ size: "sm" })}
              >
                {t.signIn}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t.mine.title}</h2>
          <ul className="flex flex-col divide-y rounded-lg border">
            {suggestions.map((s) => {
              const item = s.itemId ? roadmapItem(s.itemId) : undefined;
              return (
                <li key={s.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={s.status === "accepted" ? "default" : "outline"}>
                      {t.mine[s.status]}
                    </Badge>
                    <span className="font-medium">{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.areas[s.area as keyof typeof t.areas] ?? s.area} · {s.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  {s.detail && <p className="text-muted-foreground">{s.detail}</p>}
                  {s.reason && <p className="text-xs text-muted-foreground">{s.reason[lang]}</p>}
                  {item && (
                    <Link href={`#item-${item.id}`} className="text-xs underline underline-offset-2">
                      {t.mine.seeItem}：{item.title[lang]}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
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
        <Roadmap />
      </Suspense>
    </div>
  );
}
