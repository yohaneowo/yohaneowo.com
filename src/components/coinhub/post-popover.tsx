"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PanelRightOpenIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/i18n/locale-provider";
import type { ChartController } from "@/lib/coinhub/chart-controller";
import { setState, useTerminal } from "@/lib/coinhub/store";
import { accountKey, postOnChart, useXPosts, xPosts } from "@/lib/coinhub/x-posts";
import { lightboxOpen } from "./image-lightbox";
import { PostCardBody } from "./post-card";

const WIDTH = 340;
const GAP = 14;

// A post badge clicked on the chart: that post as a card beside it, with arrows through the same
// author's posts on this symbol (the chart follows), a way to the posts panel and a close button.
// Closed by Escape, a click elsewhere or another chart.
export function PostPopover({
  chart,
  chartKey,
  controller,
}: {
  chart: number;
  chartKey: string | null;
  controller: ChartController;
}) {
  const { t } = useLocale();
  const p = t.coinhub.posts;
  const card = useXPosts((s) => (s.card?.chart === chart ? s.card : null));
  const posts = useXPosts((s) => s.posts);
  const selected = useXPosts((s) => s.selected);
  const hidden = useTerminal((s) => s.posts.hidden);
  const ref = useRef<HTMLDivElement>(null);

  const post = card ? posts.find((x) => x.id === card.id) : undefined;
  // The author's posts on this chart, oldest first.
  const thread = useMemo(() => {
    if (!post || !chartKey) return [];
    const key = accountKey(post);
    return posts
      .filter((x) => accountKey(x) === key && !hidden.includes(key) && postOnChart(x, chartKey).on)
      .sort((a, b) => a.time - b.time);
  }, [post, posts, hidden, chartKey]);
  const at = post ? thread.findIndex((x) => x.id === post.id) : -1;

  useEffect(() => {
    if (!card) return;
    const close = () => xPosts.set({ card: null });
    // The enlarged image over it takes Escape and clicks first.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !lightboxOpen() && close();
    // A press outside the card closes it (a press on another badge then opens that one).
    const onDown = (e: PointerEvent) => {
      if (!lightboxOpen() && !ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [card]);

  if (!card || !post) return null;
  // Inside the chart area, above the badge (they sit at the bottom of the pane), as tall as the
  // room there allows.
  const left = Math.max(8, Math.min(card.x - WIDTH / 2, card.width - WIDTH - 8));
  const maxHeight = Math.max(160, card.y - GAP - 8);

  const go = (i: number) => {
    const next = thread[i];
    if (!next) return;
    xPosts.set({ card: { ...card, id: next.id }, selected: next.id, highlight: [next.id] });
    controller.goToDate(next.time);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={post.authorName ?? `@${post.account}`}
      className="absolute z-30 flex flex-col rounded-lg border bg-popover text-xs text-popover-foreground shadow-xl"
      style={{ left, bottom: Math.max(8, card.height - card.y + GAP), width: WIDTH, maxHeight }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-1.5">
        {thread.length > 1 && (
          <>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={at <= 0}
              onClick={() => go(at - 1)}
              aria-label={p.older}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {at + 1} / {thread.length}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={at >= thread.length - 1}
              onClick={() => go(at + 1)}
              aria-label={p.newer}
            >
              <ChevronRightIcon />
            </Button>
          </>
        )}
        <span className="flex-1" />
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => {
            xPosts.set({ card: null, highlight: [post.id], selected: post.id });
            setState((s) => ({ panel: "posts", active: chart, posts: { ...s.posts, scope: "symbol" } }));
          }}
          aria-label={p.openPanel}
          title={p.openPanel}
        >
          <PanelRightOpenIcon />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => xPosts.set({ card: null })}
          aria-label={p.close}
        >
          <XIcon />
        </Button>
      </div>
      <ScrollArea className={cn("min-h-0 flex-1")}>
        <div className="flex flex-col gap-1.5 p-3">
          <PostCardBody
            post={post}
            chartKey={chartKey}
            selected={selected === post.id}
            onSelect={() => {
              xPosts.set({ selected: selected === post.id ? null : post.id });
              controller.goToDate(post.time);
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
