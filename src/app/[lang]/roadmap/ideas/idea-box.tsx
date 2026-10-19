"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { HeartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-provider";
import type { RoadmapArea } from "@/lib/roadmap";
import type { Idea } from "@/lib/roadmap-store";
import { cn } from "@/lib/utils";
import { likeIdea } from "../actions";
import { AreaDot } from "../item-parts";

type Sort = "hot" | "newest";

// Where an accepted idea's item lives: the changelog once shipped, the roadmap before.
export type IdeaLink = { href: string; title: string };

// The public suggestions: like the ones you want (one like each, press again to take it back).
// Only ideas waiting for review take likes.
export function IdeaBox({
  ideas,
  links,
  signedIn,
}: {
  ideas: Idea[];
  links: Record<string, IdeaLink>;
  signedIn: boolean;
}) {
  const { t: dict, lang, href } = useLocale();
  const t = dict.roadmap;
  const [sort, setSort] = useState<Sort>("hot");
  const [likes, setLikes] = useState(() => Object.fromEntries(ideas.map((idea) => [idea.id, idea.likes])));
  const [liked, setLiked] = useState(
    () => new Set(ideas.filter((idea) => idea.liked).map((idea) => idea.id)),
  );
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  function like(id: string) {
    const had = liked.has(id);
    const flip = (set: Set<string>, on: boolean) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    };
    setLiked((current) => flip(current, !had));
    setLikes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? -1 : 1)) }));
    setError(false);
    startTransition(async () => {
      const result = await likeIdea(id);
      if ("error" in result) {
        setLiked((current) => flip(current, had));
        setLikes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? 1 : -1)) }));
        setError(true);
        return;
      }
      setLikes((current) => ({ ...current, [id]: result.likes }));
    });
  }

  const ordered = [...ideas].sort((a, b) =>
    sort === "hot"
      ? (likes[b.id] ?? 0) - (likes[a.id] ?? 0) || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t.ideas.sort.label}
          className="flex gap-1 rounded-lg bg-muted p-1 text-sm"
        >
          {(["hot", "newest"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                sort === value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.ideas.sort[value]}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.ideas.likeFailed}
          </p>
        )}
      </div>
      {ordered.length === 0 && <p className="text-sm text-muted-foreground">{t.ideas.empty}</p>}
      <ul className="flex flex-col gap-3">
        {ordered.map((idea) => {
          const count = likes[idea.id] ?? 0;
          const isLiked = liked.has(idea.id);
          const link = idea.itemId ? links[idea.itemId] : undefined;
          return (
            <li key={idea.id} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={idea.status === "accepted" ? "default" : "outline"}>
                    {t.ideas.status[idea.status]}
                  </Badge>
                  <h3 className="font-medium">{idea.title}</h3>
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <AreaDot area={idea.area as RoadmapArea} />
                  {t.areas[idea.area as RoadmapArea] ?? idea.area} · {idea.createdAt.slice(0, 10)}
                  {idea.mine && ` · ${t.ideas.yours}`}
                </p>
                {idea.detail && <p className="text-sm text-muted-foreground">{idea.detail}</p>}
                {idea.reason && <p className="text-xs text-muted-foreground">{idea.reason[lang]}</p>}
                {link && (
                  <Link href={href(link.href)} className="text-xs underline underline-offset-2">
                    {t.ideas.seeItem}：{link.title}
                  </Link>
                )}
              </div>
              {idea.status !== "pending" ? (
                count > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t.ideas.likes(count)}
                  </span>
                )
              ) : signedIn ? (
                <button
                  type="button"
                  onClick={() => like(idea.id)}
                  aria-pressed={isLiked}
                  aria-label={`${isLiked ? t.ideas.liked : t.ideas.like}: ${idea.title}`}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    isLiked
                      ? "border-rose-500/60 text-rose-500"
                      : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <HeartIcon className={cn("size-3.5", isLiked && "fill-current")} aria-hidden />
                  <span className="tabular-nums">{count}</span>
                </button>
              ) : (
                <Link
                  href={href("/login?next=/roadmap/ideas")}
                  title={t.ideas.likeHint}
                  aria-label={`${t.ideas.likeHint}: ${idea.title}`}
                  className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <HeartIcon className="size-3.5" aria-hidden />
                  <span className="tabular-nums">{count}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
