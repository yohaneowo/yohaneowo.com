import "server-only";
import { cacheLife } from "next/cache";
import { getSession } from "@/lib/auth";
import type { XAction, XBias, XLevelType, XPost } from "./x-posts";

// Reads the private x-monitor repo (posts from the X accounts the owner follows, see x-posts.ts)
// through GitHub's contents API with a read-only token:
//   X_MONITOR_GITHUB_TOKEN  fine-grained token, x-monitor only, Contents: read
//   X_MONITOR_REPO          owner/name, default yohaneowo/x-monitor
//   X_MONITOR_VIEWERS       comma-separated site account ids allowed to see the posts
// The token never reaches the browser; images go through /api/coinhub/posts/image.

const repo = () => process.env.X_MONITOR_REPO?.trim() || "yohaneowo/x-monitor";
const token = () => process.env.X_MONITOR_GITHUB_TOKEN?.trim() || null;

// Whether the signed-in visitor may see the posts (and the site can read them).
export async function canSeeXPosts(): Promise<boolean> {
  if (!token()) return false;
  const viewers = (process.env.X_MONITOR_VIEWERS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!viewers.length) return false;
  const session = await getSession().catch(() => null);
  return !!session && viewers.includes(session.user.id);
}

export async function fetchRepoFile(path: string): Promise<Response> {
  const key = token();
  if (!key) throw new Error("X_MONITOR_GITHUB_TOKEN is not set");
  return fetch(
    `https://api.github.com/repos/${repo()}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "yohaneowo.com",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    },
  );
}

type Row = {
  id: string | number;
  account: string;
  folder?: string;
  url: string;
  created_at: string;
  text?: string;
  summary_zh?: string;
  lang?: string | null;
  symbols?: string[];
  assets?: string[];
  stance?: Array<{ symbol: string; bias: XBias }>;
  levels?: Array<{ symbol: string; type: XLevelType; price: number | string; note?: string }>;
  timeframe?: string | null;
  action?: XAction;
  images?: string[];
  has_video?: boolean;
  quoted_post_id?: string | null;
  reply_to_post_id?: string | null;
};

function toPost(r: Row): XPost | null {
  const time = Date.parse(r.created_at);
  if (!Number.isFinite(time) || !r.id) return null;
  return {
    id: String(r.id),
    account: r.account,
    folder: r.folder ?? r.account.toLowerCase(),
    url: r.url,
    time,
    text: r.text ?? "",
    summary: r.summary_zh ?? "",
    lang: r.lang ?? null,
    symbols: r.symbols ?? [],
    assets: r.assets ?? [],
    stance: r.stance ?? [],
    levels: (r.levels ?? [])
      .map((l) => ({ symbol: l.symbol, type: l.type ?? "other", price: Number(l.price), note: l.note ?? "" }))
      .filter((l) => Number.isFinite(l.price)),
    timeframe: r.timeframe ?? null,
    action: r.action ?? "none",
    images: r.images ?? [],
    hasVideo: !!r.has_video,
    quotedId: r.quoted_post_id ?? null,
    replyTo: r.reply_to_post_id ?? null,
  };
}

// Every post, oldest first. The bot commits around 01:00 and 13:00 UTC; ten minutes old at most.
// A line that doesn't parse is skipped (the bot's own build script validates the rest).
export async function getXPosts(): Promise<XPost[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86_400 });
  const response = await fetchRepoFile("index.jsonl");
  if (!response.ok) throw new Error(`x-monitor index.jsonl: HTTP ${response.status}`);
  const posts: XPost[] = [];
  for (const line of (await response.text()).split("\n")) {
    if (!line.trim()) continue;
    try {
      const post = toPost(JSON.parse(line) as Row);
      if (post) posts.push(post);
    } catch {
      // A bad line: skip it.
    }
  }
  const unique = new Map(posts.map((p) => [p.id, p]));
  return [...unique.values()].sort((a, b) => a.time - b.time);
}
