"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  EyeIcon,
  EyeOffIcon,
  FolderGit2Icon,
  LockIcon,
  PlugIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { localePath } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";
import { getState, setState, useTerminal } from "@/lib/coinhub/store";
import {
  accountKey,
  addPublicSource,
  chartSymbolKey,
  connectGitHubUrl,
  loadXPosts,
  postOnChart,
  removeSource,
  useXPosts,
  xPosts,
  type XPost,
  type XSource,
} from "@/lib/coinhub/x-posts";
import { useActiveSymbol } from "./hooks";
import { PostCardBody, XAvatar } from "./post-card";
import { registry } from "./ui-store";

// The repo people start their own from: the format, the index script and the bot's instructions.
export const X_TEMPLATE_URL = "https://github.com/yohaneowo/x-monitor-template";

// Back from GitHub (?xposts=connected&n=2, ?xposts=noIndex…): say how it went, open the panel and
// tidy the address. Called once by the side bar, which is always there.
export function useXPostsReturn() {
  const { t } = useLocale();
  const r = t.coinhub.posts.returned;
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("xposts");
    if (!code) return;
    const n = Number(url.searchParams.get("n") ?? 0);
    if (code === "connected") toast.success(r.connected(n));
    else {
      const message = r[code as Exclude<keyof typeof r, "connected">];
      toast.error(typeof message === "string" ? message : r.failed);
    }
    setState({ panel: "posts" });
    url.searchParams.delete("xposts");
    url.searchParams.delete("n");
    window.history.replaceState(null, "", url);
    loadXPosts(true);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// The X posts (lib/coinhub/x-posts.ts): the chart symbol's or all of them, newest first, with the
// accounts to leave out; a mark clicked on the chart points its posts out here. Selecting a post
// draws its price levels on the charts and moves the active chart to it. The sources (repos) are
// managed here too, and shown first while there are none.
export function PostsPanel() {
  const { t, lang } = useLocale();
  const p = t.coinhub.posts;
  const status = useXPosts((s) => s.status);
  const posts = useXPosts((s) => s.posts);
  const sources = useXPosts((s) => s.sources);
  const highlight = useXPosts((s) => s.highlight);
  const selected = useXPosts((s) => s.selected);
  const show = useTerminal((s) => s.posts.show);
  const hidden = useTerminal((s) => s.posts.hidden);
  const scope = useTerminal((s) => s.posts.scope);
  const [manage, setManage] = useState(false);
  const { symbol } = useActiveSymbol();
  const key = symbol ? chartSymbolKey(symbol) : null;

  useEffect(() => {
    loadXPosts();
  }, []);

  const accounts = useMemo(() => {
    const by = new Map<string, { key: string; post: XPost; count: number }>();
    for (const post of posts) {
      const k = accountKey(post);
      const a = by.get(k) ?? { key: k, post, count: 0 };
      a.count++;
      by.set(k, a);
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }, [posts]);

  const list = useMemo(() => {
    const visible = posts.filter((post) => !hidden.includes(accountKey(post)));
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

  const showSources = status === "ready" && (manage || sources.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{t.coinhub.panels.posts}</span>
        {status !== "signedOut" && (
          <div className="flex items-center gap-0.5">
            {/* With no sources yet the panel shows them anyway: no toggle then. */}
            {sources.length > 0 && (
              <Button
                size="icon-sm"
                variant={showSources ? "secondary" : "ghost"}
                onClick={() => setManage((v) => !v)}
                aria-label={p.sources}
                title={p.sources}
              >
                <PlugIcon />
              </Button>
            )}
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
        )}
      </div>
      {status === "signedOut" ? (
        <div className="space-y-3 px-3 py-4 text-xs text-muted-foreground">
          <p>{p.signIn}</p>
          <Link href={localePath(lang, "/login")} className={buttonVariants({ size: "sm" })}>
            {p.signInButton}
          </Link>
        </div>
      ) : showSources ? (
        <ScrollArea className="min-h-0 flex-1">
          <Sources sources={sources} done={sources.length ? () => setManage(false) : undefined} />
        </ScrollArea>
      ) : (
        <>
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
            {accounts.length > 1 && (
              <div className="flex flex-wrap gap-1" aria-label={p.accounts}>
                <button
                  type="button"
                  aria-pressed={!accounts.some((a) => hidden.includes(a.key))}
                  onClick={() => setPosts({ hidden: [] })}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    accounts.some((a) => hidden.includes(a.key)) ? "hover:bg-muted" : "bg-muted font-medium",
                  )}
                >
                  {p.allAccounts}
                </button>
                {accounts.map((a) => {
                  const off = hidden.includes(a.key);
                  const others = accounts.filter((o) => o.key !== a.key).map((o) => o.key);
                  const alone = !off && others.every((k) => hidden.includes(k));
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={!off}
                      // A click shows this account alone (again: everyone); Ctrl / ⌘ adds or removes it.
                      onClick={(e) =>
                        setPosts({
                          hidden:
                            e.ctrlKey || e.metaKey
                              ? off
                                ? hidden.filter((h) => h !== a.key)
                                : [...hidden, a.key]
                              : alone
                                ? []
                                : others,
                        })
                      }
                      title={`@${a.post.account} · ${p.count(a.count)} · ${p.accountHint}`}
                      className={cn(
                        "flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px]",
                        off ? "opacity-40" : alone ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <XAvatar post={a.post} size={16} />
                      <span className="max-w-24 truncate">{a.post.authorName ?? a.post.account}</span>
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
            {(status === "idle" || status === "loading") && !posts.length && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{p.loading}</p>
            )}
            {status === "ready" && !list.length && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {!posts.length ? p.noPosts : scope === "symbol" ? p.emptySymbol : p.empty}
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
              />
            ))}
            <p className="px-3 py-3 text-[10px] text-muted-foreground">{p.hint}</p>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

// The sources: each repo with how its last read went, "connect GitHub" for private repos (the
// site's GitHub App) and a field for a public repo.
function Sources({ sources, done }: { sources: XSource[]; done?: () => void }) {
  const { t, lang } = useLocale();
  const p = t.coinhub.posts;
  const app = useXPosts((s) => s.app);
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = p.sourceErrors as Record<string, string>;

  const add = async () => {
    if (!repo.trim()) return;
    setBusy(true);
    setError(null);
    const code = await addPublicSource(repo);
    setBusy(false);
    if (code) setError(errors[code] ?? errors.unavailable);
    else setRepo("");
  };

  return (
    <div className="space-y-4 px-3 py-3 text-xs">
      <p className="leading-relaxed text-muted-foreground">{p.sourcesIntro}</p>
      {sources.length > 0 && (
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5">
              {s.private ? (
                <LockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={p.private} />
              ) : (
                <FolderGit2Icon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-label={p.public}
                />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={`https://github.com/${s.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-medium hover:underline"
                >
                  {s.repo}
                </a>
                <div className={cn("text-[11px]", s.lastError ? "text-[#f23645]" : "text-muted-foreground")}>
                  {s.lastError ? (errors[s.lastError] ?? errors.unavailable) : p.sourceCount(s.count ?? 0)}
                </div>
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => removeSource(s.id)}
                aria-label={p.remove}
                title={p.remove}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1.5">
        <div className="font-medium">{p.privateRepo}</div>
        {app ? (
          <>
            <a href={connectGitHubUrl(lang)} className={cn(buttonVariants({ size: "sm" }), "w-full")}>
              <FolderGit2Icon />
              {p.connectGitHub}
            </a>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {p.connectHint}{" "}
              <a href={connectGitHubUrl(lang, "authorize")} className="underline hover:text-foreground">
                {p.reauthorize}
              </a>
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">{p.appMissing}</p>
        )}
      </div>
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="x-public-repo" className="block font-medium">
          {p.publicRepo}
        </label>
        <div className="flex gap-1.5">
          <Input
            id="x-public-repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder={p.publicPlaceholder}
            className="h-8 text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !repo.trim()}>
            {busy ? p.adding : p.add}
          </Button>
        </div>
        {error && <p className="text-[11px] text-[#f23645]">{error}</p>}
      </form>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {p.templateHint}{" "}
        <a href={X_TEMPLATE_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          {p.template} ↗
        </a>
      </p>
      {done && (
        <Button size="sm" variant="outline" className="w-full" onClick={done}>
          {p.done}
        </Button>
      )}
    </div>
  );
}

function PostRow({
  post,
  chartKey,
  highlighted,
  selected,
  onSelect,
  rowRef,
}: {
  post: XPost;
  chartKey: string | null;
  highlighted: boolean;
  selected: boolean;
  onSelect: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={rowRef}
      className={cn(
        "flex flex-col gap-1.5 border-b px-3 py-2 text-xs",
        highlighted && "bg-primary/10",
        selected && "ring-1 ring-primary ring-inset",
      )}
    >
      <PostCardBody post={post} chartKey={chartKey} selected={selected} onSelect={onSelect} />
    </div>
  );
}
