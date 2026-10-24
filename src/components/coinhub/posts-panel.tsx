"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CrosshairIcon, EyeIcon, EyeOffIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/i18n/locale-provider";
import { getState, setChartSymbol, setState, useTerminal } from "@/lib/coinhub/store";
import {
  accountColor,
  accountTag,
  biasColor,
  chartSymbolKey,
  LEVEL_COLORS,
  loadXPosts,
  postImageUrl,
  postOnChart,
  postSymbolKey,
  useXPosts,
  xPosts,
  type XPost,
} from "@/lib/coinhub/x-posts";
import { useActiveSymbol } from "./hooks";
import { registry } from "./ui-store";

// The chart symbol a post's symbol opens (the reverse of the keys in x-posts.ts): a coin on its
// Binance USDT pair, Yahoo tickers and indexes as they are.
function chartIdFor(key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("COIN:")) return `BINANCE:${key.slice(5)}USDT`;
  if (key.startsWith("PAIR:")) return `BINANCE:${key.slice(5)}`;
  return key;
}

// The X posts (lib/coinhub/x-posts.ts): the chart symbol's or all of them, newest first, with the
// accounts to leave out; a mark clicked on the chart points its posts out here. Selecting a post
// draws its price levels on the charts and moves the active chart to it.
export function PostsPanel() {
  const { t, lang } = useLocale();
  const p = t.coinhub.posts;
  const status = useXPosts((s) => s.status);
  const posts = useXPosts((s) => s.posts);
  const highlight = useXPosts((s) => s.highlight);
  const selected = useXPosts((s) => s.selected);
  const show = useTerminal((s) => s.posts.show);
  const hidden = useTerminal((s) => s.posts.hidden);
  const scope = useTerminal((s) => s.posts.scope);
  const { symbol } = useActiveSymbol();
  const key = symbol ? chartSymbolKey(symbol) : null;

  useEffect(() => {
    loadXPosts();
  }, []);

  const accounts = useMemo(() => {
    const by = new Map<string, { folder: string; account: string; count: number }>();
    for (const post of posts) {
      const a = by.get(post.folder) ?? { folder: post.folder, account: post.account, count: 0 };
      a.count++;
      by.set(post.folder, a);
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }, [posts]);

  const list = useMemo(() => {
    const visible = posts.filter((post) => !hidden.includes(post.folder));
    const shown = scope === "symbol" && key ? visible.filter((post) => postOnChart(post, key).on) : visible;
    return [...shown].sort((a, b) => b.time - a.time);
  }, [posts, hidden, scope, key]);

  // Bring the posts of a clicked mark into view.
  const rows = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    const first = highlight.find((id) => rows.current.has(id));
    if (first) rows.current.get(first)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight, list]);

  const setPosts = (patch: Partial<ReturnType<typeof getState>["posts"]>) =>
    setState((s) => ({ posts: { ...s.posts, ...patch } }));

  const select = (post: XPost) => {
    const next = selected === post.id ? null : post.id;
    xPosts.set({ selected: next, highlight: next ? [post.id] : [] });
    if (next && key && postOnChart(post, key).on) registry.get(getState().active)?.goToDate(post.time);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{t.coinhub.panels.posts}</span>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setPosts({ show: !show })}
            aria-label={show ? p.hideMarks : p.showMarks}
            title={show ? p.hideMarks : p.showMarks}
          >
            {show ? <EyeIcon /> : <EyeOffIcon />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => loadXPosts(true)}
            aria-label={p.refresh}
            title={p.refresh}
            disabled={status === "loading"}
          >
            <RotateCwIcon className={cn(status === "loading" && "animate-spin")} />
          </Button>
        </div>
      </div>
      <div className="shrink-0 space-y-2 border-b px-3 py-2">
        <div role="tablist" className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          {(["symbol", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setPosts({ scope: s })}
              className={cn(
                "flex-1 truncate rounded px-2 py-1",
                scope === s
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "symbol" ? (symbol?.display ?? p.thisSymbol) : p.all}
            </button>
          ))}
        </div>
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-1" aria-label={p.accounts}>
            {accounts.map((a) => {
              const off = hidden.includes(a.folder);
              return (
                <button
                  key={a.folder}
                  type="button"
                  aria-pressed={!off}
                  onClick={() =>
                    setPosts({ hidden: off ? hidden.filter((h) => h !== a.folder) : [...hidden, a.folder] })
                  }
                  title={`@${a.account} · ${p.count(a.count)}`}
                  className={cn(
                    "flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px]",
                    off ? "opacity-40" : "hover:bg-muted",
                  )}
                >
                  <Avatar account={a.account} folder={a.folder} size={16} />
                  <span className="max-w-24 truncate">{a.account}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {status === "error" && !posts.length && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{p.error}</p>
        )}
        {status !== "error" && !posts.length && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{p.loading}</p>
        )}
        {posts.length > 0 && !list.length && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {scope === "symbol" ? p.emptySymbol : p.empty}
          </p>
        )}
        {list.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            chartKey={key}
            highlighted={highlight.includes(post.id)}
            selected={selected === post.id}
            onSelect={() => select(post)}
            rowRef={(el) => {
              if (el) rows.current.set(post.id, el);
              else rows.current.delete(post.id);
            }}
            lang={lang}
          />
        ))}
        <p className="px-3 py-3 text-[10px] text-muted-foreground">{p.hint}</p>
      </ScrollArea>
    </div>
  );
}

function Avatar({ account, folder, size }: { account: string; folder: string; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: accountColor(folder), fontSize: size * 0.42 }}
      aria-hidden
    >
      {accountTag(account)}
    </span>
  );
}

function PostRow({
  post,
  chartKey,
  highlighted,
  selected,
  onSelect,
  rowRef,
  lang,
}: {
  post: XPost;
  chartKey: string | null;
  highlighted: boolean;
  selected: boolean;
  onSelect: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
  lang: string;
}) {
  const { t } = useLocale();
  const p = t.coinhub.posts;
  const [original, setOriginal] = useState(false);
  const activeChart = useTerminal((s) => s.active);
  const onChart = chartKey ? postOnChart(post, chartKey).on : false;
  const time = new Date(post.time).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (
    <div
      ref={rowRef}
      className={cn(
        "flex flex-col gap-1.5 border-b px-3 py-2 text-xs",
        highlighted && "bg-primary/10",
        selected && "ring-1 ring-primary ring-inset",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar account={post.account} folder={post.folder} size={22} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">@{post.account}</div>
          <div className="truncate text-[10px] text-muted-foreground tabular-nums">
            {time}
            {(post.quotedId || post.replyTo) && ` · ${post.replyTo ? p.thread : p.quoted}`}
          </div>
        </div>
        {post.action !== "none" && (
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px]">{p.actions[post.action]}</span>
        )}
      </div>
      {post.stance.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.stance.map((s, i) => {
            const key = postSymbolKey(s.symbol);
            const here = key !== null && key === chartKey;
            const target = chartIdFor(key);
            const name = post.assets[post.symbols.indexOf(s.symbol)] ?? s.symbol.split(":")[1] ?? s.symbol;
            return (
              <button
                key={`${s.symbol}_${i}`}
                type="button"
                disabled={here || !target}
                onClick={() => target && setChartSymbol(activeChart, target)}
                title={here ? s.symbol : p.switchTo(s.symbol)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                  !here && target && "hover:opacity-80",
                )}
                style={{ background: biasColor(s.bias) }}
              >
                {name} {p.bias[s.bias ?? "none"]}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" onClick={onSelect} className="text-left leading-relaxed">
        {original ? <span className="whitespace-pre-wrap">{post.text}</span> : post.summary || post.text}
      </button>
      {post.images.length > 0 && (
        <div className={cn("grid gap-1", post.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {post.images.slice(0, 4).map((path) => (
            <a
              key={path}
              href={postImageUrl(path)}
              target="_blank"
              rel="noreferrer"
              className="relative block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private images through our own proxy */}
              <img
                src={postImageUrl(path)}
                alt=""
                loading="lazy"
                className="aspect-video w-full rounded border object-cover"
              />
              {post.hasVideo && (
                <PlayIcon className="absolute top-1/2 left-1/2 size-6 -translate-1/2 rounded-full bg-black/50 p-1 text-white" />
              )}
            </a>
          ))}
        </div>
      )}
      {post.levels.length > 0 && (
        <ul className="space-y-0.5">
          {post.levels.map((l, i) => (
            <li key={i} className="flex items-baseline gap-1.5 tabular-nums">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLORS[l.type] }} />
              <span className="text-muted-foreground">
                {post.assets[post.symbols.indexOf(l.symbol)] ?? l.symbol.split(":")[1]}
              </span>
              <span>{p.levelTypes[l.type]}</span>
              <span className="font-medium">
                {l.price.toLocaleString("en-US", { maximumFractionDigits: 8 })}
              </span>
              {l.note && <span className="truncate text-muted-foreground">{l.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] whitespace-nowrap text-muted-foreground">
        {post.summary && post.text && (
          <button type="button" className="hover:text-foreground" onClick={() => setOriginal((v) => !v)}>
            {original ? p.summary : p.original}
          </button>
        )}
        {onChart && (
          <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={onSelect}>
            <CrosshairIcon className="size-3" />
            {selected ? p.unselect : p.locate}
          </button>
        )}
        <a href={post.url} target="_blank" rel="noreferrer" className="ml-auto hover:text-foreground">
          {p.openX} ↗
        </a>
      </div>
    </div>
  );
}
