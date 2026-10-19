"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_STATUSES, type RoadmapArea, type RoadmapStatus } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { voteForItem } from "./actions";

export type BoardItem = {
  id: string;
  status: RoadmapStatus;
  area: RoadmapArea;
  title: string;
  detail: string;
  added: string;
  shipped: string | null;
};

type Sort = "votes" | "newest";

// The three columns. Votes change optimistically and settle on the server's count.
export function RoadmapBoard({
  items,
  counts,
  mine,
  signedIn,
}: {
  items: BoardItem[];
  counts: Record<string, number>;
  mine: string[];
  signedIn: boolean;
}) {
  const { t: dict, href } = useLocale();
  const t = dict.roadmap;
  const [sort, setSort] = useState<Sort>("votes");
  const [votes, setVotes] = useState(counts);
  const [voted, setVoted] = useState(() => new Set(mine));
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  // A link to one item (#item-…, e.g. from a planned page): the cards stream in after the page,
  // so the browser can't jump there by itself. Scroll to it and mark it.
  useEffect(() => {
    function reveal() {
      const card = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!card?.id.startsWith("item-")) return;
      document.querySelectorAll("[data-linked]").forEach((el) => el.removeAttribute("data-linked"));
      card.setAttribute("data-linked", "");
      card.scrollIntoView({ block: "center" });
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  function vote(id: string) {
    const had = voted.has(id);
    const next = new Set(voted);
    if (had) next.delete(id);
    else next.add(id);
    setVoted(next);
    setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? -1 : 1)) }));
    setError(false);
    startTransition(async () => {
      const result = await voteForItem(id);
      if ("error" in result) {
        // Put it back as it was.
        setVoted((current) => {
          const back = new Set(current);
          if (had) back.add(id);
          else back.delete(id);
          return back;
        });
        setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? 1 : -1)) }));
        setError(true);
        return;
      }
      setVotes((current) => ({ ...current, [id]: result.votes }));
    });
  }

  const ordered = (status: RoadmapStatus) =>
    items
      .filter((item) => item.status === status)
      .sort((a, b) => {
        if (status === "shipped") return (b.shipped ?? "").localeCompare(a.shipped ?? "");
        if (sort === "votes")
          return (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || b.added.localeCompare(a.added);
        return b.added.localeCompare(a.added);
      });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t.sort.label} className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["votes", "newest"] as const).map((value) => (
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
              {t.sort[value]}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.voteFailed}
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => {
          const column = ordered(status);
          return (
            <section key={status} aria-labelledby={`roadmap-${status}`} className="flex flex-col gap-3">
              <div>
                <h2 id={`roadmap-${status}`} className="flex items-center gap-2 font-medium">
                  {t.statuses[status]}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
                    {column.length}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">{t.statusHints[status]}</p>
              </div>
              {column.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
              {column.map((item) => {
                const count = votes[item.id] ?? 0;
                const isMine = voted.has(item.id);
                return (
                  <article
                    key={item.id}
                    id={`item-${item.id}`}
                    className="flex scroll-mt-32 flex-col gap-2 rounded-xl border bg-card p-4 data-[linked]:ring-2 data-[linked]:ring-primary/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Badge variant="secondary">{t.areas[item.area]}</Badge>
                        <h3 className="leading-snug font-medium">{item.title}</h3>
                      </div>
                      {status === "shipped" ? (
                        count > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {t.votes(count)}
                          </span>
                        )
                      ) : signedIn ? (
                        <button
                          type="button"
                          onClick={() => vote(item.id)}
                          aria-pressed={isMine}
                          aria-label={`${isMine ? t.voted : t.vote}: ${item.title}`}
                          className={cn(
                            "flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 text-xs transition-colors",
                            isMine
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                          )}
                        >
                          <ChevronUpIcon className="size-4" aria-hidden />
                          <span className="tabular-nums">{count}</span>
                        </button>
                      ) : (
                        <Link
                          href={href("/login?next=/roadmap")}
                          title={t.voteHint}
                          aria-label={`${t.voteHint}: ${item.title}`}
                          className="flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUpIcon className="size-4" aria-hidden />
                          <span className="tabular-nums">{count}</span>
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                    {item.shipped && (
                      <p className="text-xs text-muted-foreground">{t.shippedOn(item.shipped)}</p>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
