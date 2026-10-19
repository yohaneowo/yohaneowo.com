import Image from "next/image";
import Link from "next/link";
import { ExternalLinkIcon, GiftIcon, HelpCircleIcon, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PickItem, PicksView } from "@/lib/movies";
import { cn } from "@/lib/utils";

// The 推荐 page's content for one kind (films or anime): picks left, today's cards (drawn ones
// face up, the rest face down) and the last 30 days. Shared with the dev preview page.
export type PicksText = Dictionary["moviehub"]["picks"];

// What became of a pick: the dictionary's status line for its action.
function statusText(t: PicksText, pick: PickItem) {
  switch (pick.action) {
    case "skip":
      return t.status.skip;
    case "watchlist":
      return t.status.watchlist;
    case "watched":
      return t.status.watched(pick.rating);
    case "watched_existing":
      return t.status.watched_existing(pick.rating);
    case "rated":
      return t.status.rated(pick.rating);
    default:
      return t.status.pending;
  }
}

function modeText(t: PicksText, kind: "movie" | "anime", mode: string) {
  const modes: Record<string, string> = t.modes[kind];
  return modes[mode] ?? mode;
}

// A pick drawn today, face up.
function PickCard({ t, kind, pick }: { t: PicksText; kind: "movie" | "anime"; pick: PickItem }) {
  return (
    <Card size="sm" className={cn("pt-0", pick.action === "skip" && "opacity-60")}>
      <a href={pick.url} target="_blank" rel="noreferrer" className="relative block aspect-[2/3] bg-muted">
        {pick.poster && (
          <Image
            src={pick.poster}
            alt=""
            fill
            unoptimized
            referrerPolicy="no-referrer"
            sizes="(min-width: 1024px) 20vw, 50vw"
            className="object-cover"
          />
        )}
      </a>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{modeText(t, kind, pick.mode)}</Badge>
          {pick.usesBonus && (
            <Badge variant="outline">
              <GiftIcon aria-hidden />
              {t.bonusCard}
            </Badge>
          )}
        </div>
        <CardTitle className="leading-snug">
          <a href={pick.url} target="_blank" rel="noreferrer" className="hover:underline">
            {pick.title}
          </a>
        </CardTitle>
        <CardDescription>{[pick.year, ...pick.people].filter(Boolean).join(" · ")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{pick.reason}</p>
        <p className="text-xs font-medium">{statusText(t, pick)}</p>
      </CardContent>
    </Card>
  );
}

// A pick still to draw today, face down.
function UnopenedCard({ t, kind, bonus }: { t: PicksText; kind: "movie" | "anime"; bonus?: boolean }) {
  return (
    <div className="flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-center">
      <HelpCircleIcon className="size-10 text-muted-foreground/60" aria-hidden />
      <span className="text-sm font-medium text-muted-foreground">{bonus ? t.bonusCard : t.unopened}</span>
      <span className="text-xs text-muted-foreground">{t.draw[kind]}</span>
    </div>
  );
}

export function PicksBody({ t, lang, view }: { t: PicksText; lang: "zh" | "en"; view: PicksView }) {
  const kind = view.kind;
  // Face-down cards: the day's picks left; once those are gone, one for the bonus (if any).
  const unopened = view.remainingToday > 0 ? view.remainingToday : view.bonus > 0 ? 1 : 0;
  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t.left(view.remainingToday, view.quota)}</CardTitle>
          <CardDescription>
            {view.bonus > 0 && `${t.bonus(view.bonus)} · `}
            {t.resets}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress
            value={(view.remainingToday / Math.max(1, view.quota)) * 100}
            aria-label={t.left(view.remainingToday, view.quota)}
          />
        </CardContent>
      </Card>

      {!view.discordLinked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t.linkDiscord}</span>
          <Link href={localePath(lang, "/connect/discord")} className={buttonVariants({ size: "sm" })}>
            <LinkIcon aria-hidden />
            {t.linkAction}
          </Link>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.today}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {view.todayPicks.map((pick) => (
            <PickCard key={pick.pickId} t={t} kind={kind} pick={pick} />
          ))}
          {Array.from({ length: unopened }, (_, i) => (
            <UnopenedCard key={i} t={t} kind={kind} bonus={view.remainingToday === 0} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.history}</h2>
        {view.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noHistory}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-normal">{t.columns.title}</th>
                  <th className="px-3 py-2 font-normal">{t.columns.mode}</th>
                  <th className="px-3 py-2 font-normal">{t.columns.result}</th>
                  <th className="px-3 py-2 text-right font-normal">{t.columns.day}</th>
                </tr>
              </thead>
              <tbody>
                {view.recent.map((pick) => (
                  <tr key={pick.pickId} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <a
                        href={pick.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {pick.title}
                        <ExternalLinkIcon className="size-3 text-muted-foreground" aria-label={t.open} />
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{modeText(t, kind, pick.mode)}</td>
                    <td className="px-3 py-2">{statusText(t, pick)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {pick.day.slice(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
