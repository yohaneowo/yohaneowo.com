"use client";

import { useState } from "react";
import { CrosshairIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { useLocale } from "@/i18n/locale-provider";
import { setChartSymbol, useTerminal } from "@/lib/coinhub/store";
import {
  accountColor,
  accountTag,
  biasColor,
  LEVEL_COLORS,
  postImageUrl,
  postOnChart,
  postSymbolKey,
  type XPost,
} from "@/lib/coinhub/x-posts";
import { openLightbox } from "./image-lightbox";

// One X post as the posts panel and the chart's pop-up card show it (lib/coinhub/x-posts.ts).

// The chart symbol a post's symbol opens (the reverse of the keys in x-posts.ts): a coin on its
// Binance USDT pair, Yahoo tickers and indexes as they are.
export function chartIdFor(key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("COIN:")) return `BINANCE:${key.slice(5)}USDT`;
  if (key.startsWith("PAIR:")) return `BINANCE:${key.slice(5)}`;
  return key;
}

export function postTime(time: number, lang: string) {
  return new Date(time).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// The author's avatar from the source when the bot keeps one, else their two letters on a colour.
export function XAvatar({
  post,
  size,
}: {
  post: Pick<XPost, "account" | "folder" | "avatar" | "source">;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (post.avatar && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private images through our own proxy
      <img
        src={postImageUrl(post, post.avatar)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-muted object-cover"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: accountColor(post.folder), fontSize: size * 0.42 }}
      aria-hidden
    >
      {accountTag(post.account)}
    </span>
  );
}

// The author and when, then the views per symbol (a click opens that symbol's chart), the summary
// or the original text, the images (a click enlarges them), the price levels and the links.
export function PostCardBody({
  post,
  chartKey,
  selected,
  onSelect,
}: {
  post: XPost;
  chartKey: string | null;
  selected: boolean;
  onSelect?: () => void;
}) {
  const { t, lang } = useLocale();
  const p = t.coinhub.posts;
  const [original, setOriginal] = useState(false);
  const activeChart = useTerminal((s) => s.active);
  const onChart = chartKey ? postOnChart(post, chartKey).on : false;
  const images = post.images.map((path) => postImageUrl(post, path));
  return (
    <>
      <div className="flex items-center gap-2">
        <XAvatar post={post} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate">
            {post.authorName && <span className="font-medium">{post.authorName} </span>}
            <span className={post.authorName ? "text-muted-foreground" : "font-medium"}>@{post.account}</span>
          </div>
          <div className="truncate text-[10px] text-muted-foreground tabular-nums">
            {postTime(post.time, lang)}
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
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className="text-left leading-relaxed disabled:cursor-text"
      >
        {original ? <span className="whitespace-pre-wrap">{post.text}</span> : post.summary || post.text}
      </button>
      {images.length > 0 && (
        <div className={cn("grid gap-1", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.slice(0, 4).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => openLightbox(images, i)}
              className="relative block cursor-zoom-in"
              aria-label={p.enlarge}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private images through our own proxy */}
              <img
                src={src}
                alt=""
                loading="lazy"
                className="aspect-video w-full rounded border object-cover"
              />
              {post.hasVideo && (
                <PlayIcon className="absolute top-1/2 left-1/2 size-6 -translate-1/2 rounded-full bg-black/50 p-1 text-white" />
              )}
            </button>
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
        {onChart && onSelect && (
          <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={onSelect}>
            <CrosshairIcon className="size-3" />
            {selected ? p.unselect : p.locate}
          </button>
        )}
        <a href={post.url} target="_blank" rel="noreferrer" className="ml-auto hover:text-foreground">
          {p.openX} ↗
        </a>
      </div>
    </>
  );
}
