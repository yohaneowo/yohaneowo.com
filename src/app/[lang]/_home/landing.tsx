import Link from "next/link";
import { Suspense } from "react";
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import {
  BotCard,
  botInviteUrl,
  LatestUpdates,
  MarketBody,
  RoadmapSnippet,
  Tile,
  TileSkeleton,
} from "./parts";

// The home page before signing in: what the site is, each feature with a little live data, the
// latest updates and the Discord bot.
export function Landing({ lang, t }: { lang: Locale; t: Dictionary }) {
  const h = t.home;
  const invite = botInviteUrl();
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">yohaneowo</h1>
          <p className="mt-2 text-muted-foreground">{t.site.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={localePath(lang, "/login")} className={buttonVariants()}>
            {h.signIn}
          </Link>
          {invite && (
            <a
              href={invite}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              {h.invite}
            </a>
          )}
          <Link href={localePath(lang, "/roadmap")} className={buttonVariants({ variant: "ghost" })}>
            {h.roadmap}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="home-features">
        <h2 id="home-features" className="sr-only">
          {h.features}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Tile title={t.nav.moviehub.title} href={localePath(lang, "/moviehub")} action={h.dashboard.open}>
            <p className="text-sm text-muted-foreground">{t.nav.moviehub.description}</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {h.movie.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </Tile>
          <Tile title={t.nav.coinhub.title} href={localePath(lang, "/tradehub")} action={h.dashboard.open}>
            <p className="text-sm text-muted-foreground">{t.nav.coinhub.description}</p>
            <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted/40" />}>
              <MarketBody t={h} />
            </Suspense>
          </Tile>
          <Tile title={t.nav.dotahub.title} href={localePath(lang, "/dotahub")} action={h.dashboard.open}>
            <p className="text-sm text-muted-foreground">{t.nav.dotahub.description}</p>
          </Tile>
          <Tile title={t.nav.linkhub.title} href={localePath(lang, "/linkhub")} action={h.dashboard.open}>
            <p className="text-sm text-muted-foreground">{t.nav.linkhub.description}</p>
          </Tile>
          <Tile title={t.nav.uidhub.title}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t.nav.uidhub.description}</p>
              <Badge variant="outline">{h.planned}</Badge>
            </div>
            <Link
              href={localePath(lang, "/roadmap#item-uidhub")}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
            >
              {h.voteForIt}
            </Link>
          </Tile>
          <Tile title={t.nav.roadmap.title} href={localePath(lang, "/roadmap")} action={h.dashboard.open}>
            <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted/40" />}>
              <RoadmapSnippet lang={lang} t={h} />
            </Suspense>
          </Tile>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Tile title={h.latest} href={localePath(lang, "/roadmap/changelog")} action={h.allUpdates}>
          <LatestUpdates lang={lang} count={6} />
        </Tile>
        <Suspense fallback={<TileSkeleton />}>
          <BotCard t={h} />
        </Suspense>
      </section>
    </div>
  );
}
