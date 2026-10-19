import Link from "next/link";
import { ArrowRightIcon, BotIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getHomeMarket } from "@/lib/coinhub/server";
import { ROADMAP } from "@/lib/roadmap";
import { voteCounts } from "@/lib/roadmap-store";
import { cn } from "@/lib/utils";

// Pieces of the home page shared by the signed-out introduction and the signed-in dashboard.

// The bot's install page (its default install settings offer a server or a personal install).
export function botInviteUrl() {
  const id = process.env.DISCORD_BOT_CLIENT_ID;
  return id ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(id)}` : null;
}

export function Tile({
  title,
  href,
  action,
  className,
  children,
}: {
  title: string;
  href?: string;
  action?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {href && action && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {action}
            <ArrowRightIcon className="size-3" aria-hidden />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

export function TileSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-muted/40" />;
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map(
    (v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`,
  );
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={up ? "#16a34a" : "#dc2626"}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// BTC and ETH over 24 hours, BTC's sparkline and today's Fear & Greed (TradeHub's data).
export async function MarketBody({ t }: { t: Dictionary["home"] }) {
  const market = await getHomeMarket().catch(() => null);
  if (!market || market.coins.length === 0)
    return <p className="text-sm text-muted-foreground">{t.market.unavailable}</p>;
  const btc = market.coins.find((c) => c.symbol === "BTC");
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {market.coins.map((coin) => (
          <li key={coin.symbol} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{coin.symbol}</span>
            <span className="tabular-nums">
              {coin.price.toLocaleString("en-US", { maximumFractionDigits: coin.price >= 1000 ? 0 : 2 })}
              <span
                className={cn(
                  "ml-2 text-xs",
                  coin.changePercent >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {coin.changePercent >= 0 ? "+" : ""}
                {coin.changePercent.toFixed(2)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Sparkline values={market.btcCloses} up={(btc?.changePercent ?? 0) >= 0} />
      <p className="text-xs text-muted-foreground">
        BTC · {t.market.change24h}
        {market.fearGreed &&
          ` · ${t.market.fearGreed} ${market.fearGreed.value}（${market.fearGreed.label}）`}
      </p>
    </>
  );
}

// The newest shipped items from the roadmap.
export function LatestUpdates({ lang, count = 4 }: { lang: Locale; count?: number }) {
  const shipped = ROADMAP.filter((item) => item.status === "shipped")
    .sort((a, b) => (b.shipped ?? "").localeCompare(a.shipped ?? ""))
    .slice(0, count);
  return (
    <ul className="flex flex-col gap-2">
      {shipped.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
          <Link
            href={localePath(lang, `/roadmap/changelog#item-${item.id}`)}
            className="min-w-0 truncate hover:underline"
          >
            {item.title[lang]}
          </Link>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.shipped}</span>
        </li>
      ))}
    </ul>
  );
}

// What's on the dev site now, and the most wanted item still to build.
export async function RoadmapSnippet({ lang, t }: { lang: Locale; t: Dictionary["home"] }) {
  const counts = await voteCounts().catch(() => ({}) as Record<string, number>);
  const testing = ROADMAP.filter((item) => item.status === "testing" || item.status === "building");
  const wanted = ROADMAP.filter((item) => item.status === "considering").sort(
    (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0),
  )[0];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">{t.testing}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {testing.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link href={localePath(lang, `/roadmap#item-${item.id}`)} className="hover:underline">
                {item.title[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {wanted && (
        <div>
          <p className="text-xs text-muted-foreground">{t.topVoted}</p>
          <Link href={localePath(lang, `/roadmap#item-${wanted.id}`)} className="mt-1 block hover:underline">
            {wanted.title[lang]}
            <span className="ml-2 text-xs text-muted-foreground">{t.votes(counts[wanted.id] ?? 0)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// The bot: what it does, and the button to add it.
export function BotCard({ t, compact = false }: { t: Dictionary["home"]; compact?: boolean }) {
  const invite = botInviteUrl();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotIcon className="size-4 text-muted-foreground" aria-hidden />
          {t.bot.title}
        </CardTitle>
        <CardDescription>{t.bot.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!compact && (
          <ul className="flex flex-col gap-2 text-sm">
            {t.bot.commands.map((command) => (
              <li key={command.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <code className="shrink-0 font-mono text-xs sm:w-36">{command.name}</code>
                <span className="text-muted-foreground">{command.text}</span>
              </li>
            ))}
          </ul>
        )}
        {invite && (
          <a
            href={invite}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: compact ? "outline" : "default" }), "self-start")}
          >
            {t.invite}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
