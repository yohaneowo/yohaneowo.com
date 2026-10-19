import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { roadmapItem } from "@/lib/roadmap";
import { listIdeas, myVotes } from "@/lib/roadmap-store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).roadmap.mine.title };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

async function Mine() {
  const lang = await getLocale();
  const t = (await getDictionary()).roadmap;
  const session = await getSession();
  if (!session)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-6 text-sm text-muted-foreground">
        {t.mine.signIn}
        <Link href={localePath(lang, "/login?next=/roadmap/me")} className={buttonVariants({ size: "sm" })}>
          {t.signIn}
        </Link>
      </div>
    );
  const [voted, ideas] = await Promise.all([myVotes(session.user.id), listIdeas(session.user.id)]);
  const items = voted.flatMap((id) => roadmapItem(id) ?? []);
  const mine = ideas.filter((idea) => idea.mine);
  const itemHref = (id: string) => {
    const item = roadmapItem(id);
    return localePath(lang, `${item?.status === "shipped" ? "/roadmap/changelog" : "/roadmap"}#item-${id}`);
  };
  return (
    <>
      <Section title={t.mine.votes}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.mine.noVotes}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <Badge variant="outline">{t.statuses[item.status]}</Badge>
                <Link href={itemHref(item.id)} className="font-medium hover:underline">
                  {item.title[lang]}
                </Link>
                <span className="text-xs text-muted-foreground">{t.areas[item.area]}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t.mine.suggestions}>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.mine.noSuggestions}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {mine.map((idea) => (
              <li key={idea.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={idea.status === "accepted" ? "default" : "outline"}>
                    {t.ideas.status[idea.status]}
                  </Badge>
                  <span className="font-medium">{idea.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {idea.createdAt.slice(0, 10)} · {t.ideas.likes(idea.likes)}
                  </span>
                </div>
                {idea.reason && <p className="text-xs text-muted-foreground">{idea.reason[lang]}</p>}
                {idea.itemId && (
                  <Link href={itemHref(idea.itemId)} className="text-xs underline underline-offset-2">
                    {t.ideas.seeItem}：{roadmapItem(idea.itemId)?.title[lang]}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

// What this account voted for and suggested.
export default async function MinePage() {
  const t = (await getDictionary()).roadmap.mine;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/40" />}>
        <Mine />
      </Suspense>
    </div>
  );
}
