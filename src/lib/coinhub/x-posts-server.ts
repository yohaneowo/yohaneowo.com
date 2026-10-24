import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { xPostSource } from "@/db/schema";
import { dropInstallationToken, GitHubError, installationToken } from "@/lib/github-app";
import type { XAction, XBias, XLevelType, XPost, XSource } from "./x-posts";

// Each site account's X posts come from its own sources (x_post_source): GitHub repos in the
// x-monitor format (SCHEMA.md there: index.jsonl at the root, images under <folder>/images/). A
// private repo is read with a token minted from the site's GitHub App installation
// (lib/github-app.ts), a public one straight from raw.githubusercontent.com. A repo's posts are
// cached ten minutes, tagged so the App's push webhook can drop them at once.

export const MAX_SOURCES = 8;
export const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
// A post's image: <folder>/images/<post id>_<n>.<ext>; an account's avatar: <folder>/avatar.<ext>.
export const IMAGE_PATH = /^[A-Za-z0-9_.-]{1,60}\/images\/\d{5,25}_\d{1,2}\.(jpg|jpeg|png|webp|gif)$/i;
export const AVATAR_PATH = /^[A-Za-z0-9_.-]{1,60}\/avatar\.(jpg|jpeg|png|webp|gif)$/i;

export const repoTag = (repo: string) => `xrepo:${repo.toLowerCase()}`;

// owner/name out of what someone typed: the pair itself or a github.com URL.
export function parseRepo(input: string): string | null {
  const text = input
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const m = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s]+)/i);
  const repo = m ? m[1] : text;
  return REPO.test(repo) ? repo : null;
}

// One file of a source repo: through the installation when there is one, else as a public file.
export async function repoFile(repo: string, path: string, installationId: string | null): Promise<Response> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  if (!installationId)
    return fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${encoded}`, {
      headers: { "User-Agent": "yohaneowo.com" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  const read = async () =>
    fetch(`https://api.github.com/repos/${repo}/contents/${encoded}`, {
      headers: {
        Authorization: `Bearer ${await installationToken(installationId)}`,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "yohaneowo.com",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  const response = await read();
  // A token from before the installation changed: mint a new one once.
  if (response.status === 401) {
    dropInstallationToken(installationId);
    return read();
  }
  return response;
}

type Row = {
  id: string | number;
  account: string;
  author_name?: string | null;
  avatar?: string | null;
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

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

type RepoPost = Omit<XPost, "source">;

function toPost(r: Row): RepoPost | null {
  const time = Date.parse(r.created_at);
  if (!Number.isFinite(time) || !r.id || typeof r.account !== "string") return null;
  return {
    id: String(r.id),
    account: r.account,
    authorName: typeof r.author_name === "string" && r.author_name.trim() ? r.author_name.trim() : null,
    avatar: typeof r.avatar === "string" && AVATAR_PATH.test(r.avatar) ? r.avatar : null,
    folder: r.folder ?? r.account.toLowerCase(),
    url: typeof r.url === "string" ? r.url : `https://x.com/${r.account}/status/${r.id}`,
    time,
    text: r.text ?? "",
    summary: r.summary_zh ?? "",
    lang: r.lang ?? null,
    symbols: list<string>(r.symbols),
    assets: list<string>(r.assets),
    stance: list<{ symbol: string; bias: XBias }>(r.stance),
    levels: list<NonNullable<Row["levels"]>[number]>(r.levels)
      .map((l) => ({ symbol: l.symbol, type: l.type ?? "other", price: Number(l.price), note: l.note ?? "" }))
      .filter((l) => Number.isFinite(l.price)),
    timeframe: r.timeframe ?? null,
    action: r.action ?? "none",
    images: list<string>(r.images).filter((p) => IMAGE_PATH.test(p)),
    hasVideo: !!r.has_video,
    quotedId: r.quoted_post_id ?? null,
    replyTo: r.reply_to_post_id ?? null,
  };
}

// Why a source can't be read. Thrown as a plain Error whose message is the code: an error leaves a
// "use cache" function as an Error, not as its own class.
export type SourceErrorCode = "notFound" | "denied" | "badFormat" | "unavailable";
const CODES: SourceErrorCode[] = ["notFound", "denied", "badFormat", "unavailable"];

export function sourceErrorCode(error: unknown): SourceErrorCode {
  const message = error instanceof Error ? error.message : "";
  return (CODES as string[]).includes(message) ? (message as SourceErrorCode) : "unavailable";
}

const fail = (code: SourceErrorCode) => new Error(code);

// A repo's posts, oldest first, with how many lines didn't parse. Without the source id: cached per
// repo and installation, the id is put on afterwards.
async function repoPosts(
  repo: string,
  installationId: string | null,
): Promise<{ posts: RepoPost[]; bad: number }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86_400 });
  cacheTag(repoTag(repo));
  let response: Response;
  try {
    response = await repoFile(repo, "index.jsonl", installationId);
  } catch (error) {
    // The installation is gone or no longer covers the repo.
    if (error instanceof GitHubError && (error.status === 404 || error.status === 403)) throw fail("denied");
    throw fail("unavailable");
  }
  if (response.status === 404) throw fail("notFound");
  if (response.status === 401 || response.status === 403) throw fail("denied");
  if (!response.ok) throw fail("unavailable");
  const posts = new Map<string, RepoPost>();
  let bad = 0;
  for (const line of (await response.text()).split("\n")) {
    if (!line.trim()) continue;
    try {
      const post = toPost(JSON.parse(line) as Row);
      if (post) posts.set(post.id, post);
      else bad++;
    } catch {
      bad++;
    }
  }
  if (!posts.size && bad) throw fail("badFormat");
  return { posts: [...posts.values()].sort((a, b) => a.time - b.time), bad };
}

// Checks that a repo can be read and is in the format (for adding it): the number of posts.
export async function probeRepo(repo: string, installationId: string | null): Promise<number> {
  return (await repoPosts(repo, installationId)).posts.length;
}

type SourceRow = typeof xPostSource.$inferSelect;

function view(row: SourceRow): XSource {
  return {
    id: row.id,
    repo: row.repo,
    private: row.installationId !== null,
    lastOkAt: row.lastOkAt?.getTime() ?? null,
    lastError: row.lastError,
    count: row.lastCount,
  };
}

export async function userSources(userId: string): Promise<SourceRow[]> {
  return db.select().from(xPostSource).where(eq(xPostSource.userId, userId)).orderBy(xPostSource.createdAt);
}

// Every post of the account's sources, newest outcome noted on each source (written only when it
// changed or is ten minutes old, not on every load).
export async function postsForUser(userId: string): Promise<{ sources: XSource[]; posts: XPost[] }> {
  const rows = await userSources(userId);
  const byId = new Map<string, XPost>();
  const sources = await Promise.all(
    rows.map(async (row) => {
      let lastError: string | null = null;
      let count = row.lastCount;
      try {
        const { posts } = await repoPosts(row.repo, row.installationId);
        count = posts.length;
        for (const p of posts) if (!byId.has(p.id)) byId.set(p.id, { ...p, source: row.id });
      } catch (error) {
        lastError = sourceErrorCode(error);
      }
      const now = new Date();
      const stale = !row.lastOkAt || now.getTime() - row.lastOkAt.getTime() > 10 * 60_000;
      if (lastError !== row.lastError || count !== row.lastCount || (!lastError && stale)) {
        const patch = lastError ? { lastError } : { lastError: null, lastOkAt: now, lastCount: count };
        await db
          .update(xPostSource)
          .set(patch)
          .where(eq(xPostSource.id, row.id))
          .catch(() => {});
        return view({ ...row, ...patch });
      }
      return view(row);
    }),
  );
  return { sources, posts: [...byId.values()].sort((a, b) => a.time - b.time) };
}

// Adds a repo to the account's sources (or points an existing one at a new installation).
export async function saveSource(userId: string, repo: string, installationId: string | null, count: number) {
  const existing = (await userSources(userId)).find((s) => s.repo.toLowerCase() === repo.toLowerCase());
  if (existing) {
    await db
      .update(xPostSource)
      .set({ repo, installationId, lastError: null, lastOkAt: new Date(), lastCount: count })
      .where(eq(xPostSource.id, existing.id));
    return existing.id;
  }
  const id = randomBytes(9).toString("base64url");
  await db.insert(xPostSource).values({
    id,
    userId,
    repo,
    installationId,
    lastOkAt: new Date(),
    lastCount: count,
  });
  return id;
}

export async function deleteSource(userId: string, id: string) {
  await db.delete(xPostSource).where(and(eq(xPostSource.userId, userId), eq(xPostSource.id, id)));
}

// The App was uninstalled, or repos were taken out of it: those sources can't be read any more.
export async function dropInstallation(installationId: string, repos?: string[]) {
  const rows = await db.select().from(xPostSource).where(eq(xPostSource.installationId, installationId));
  for (const row of rows)
    if (!repos || repos.some((r) => r.toLowerCase() === row.repo.toLowerCase()))
      await db.delete(xPostSource).where(eq(xPostSource.id, row.id));
}

// One image of one of the account's sources (null: not theirs, or not there).
export async function sourceImage(userId: string, sourceId: string, path: string): Promise<Response | null> {
  if (!IMAGE_PATH.test(path) && !AVATAR_PATH.test(path)) return null;
  const [row] = await db
    .select()
    .from(xPostSource)
    .where(and(eq(xPostSource.userId, userId), eq(xPostSource.id, sourceId)));
  if (!row) return null;
  const response = await repoFile(row.repo, path, row.installationId).catch(() => null);
  return response?.ok && response.body ? response : null;
}
