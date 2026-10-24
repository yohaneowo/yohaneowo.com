import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { localePath } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { deleteSource, MAX_SOURCES, probeRepo, saveSource, userSources } from "@/lib/coinhub/x-posts-server";
import { GitHubError, installationsForCode } from "@/lib/github-app";
import { GITHUB_STATE_COOKIE, readGitHubState } from "@/lib/github-state";

// Back from GitHub (the App's install or authorization page) with an OAuth code. The code shows
// which installations of the App this GitHub user can reach, so a forged installation_id can't
// attach someone else's repos. Every repo of those installations with an index.jsonl in the
// x-monitor format becomes one of the account's sources; sources of those installations whose repo
// was taken out are dropped. Then back to TradeHub, which says how it went.
const MAX_PROBES = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ?? url.origin;
  const jar = await cookies();
  const state = readGitHubState(url.searchParams.get("state"), jar.get(GITHUB_STATE_COOKIE)?.value);
  jar.delete(GITHUB_STATE_COOKIE);
  const lang = state?.lang ?? "zh";
  const back = (query: string) =>
    NextResponse.redirect(new URL(`${localePath(lang, "/tradehub")}?xposts=${query}`, origin));
  if (!state) return back("state");
  const session = await getSession();
  if (!session || session.user.id !== state.userId) return back("signIn");
  const code = url.searchParams.get("code");
  if (!code) return back("denied");

  try {
    const installs = await installationsForCode(code, `${origin}/api/coinhub/posts/github/callback`);
    const existing = await userSources(session.user.id);
    // Repos taken out of an installation this person still has.
    for (const source of existing) {
      const install = installs.find((i) => i.id === source.installationId);
      if (install && !install.repos.some((r) => r.toLowerCase() === source.repo.toLowerCase()))
        await deleteSource(session.user.id, source.id);
    }
    const candidates = installs.flatMap((i) => i.repos.map((repo) => ({ repo, installationId: i.id })));
    const found = (
      await Promise.all(
        candidates.slice(0, MAX_PROBES).map(async (c) => {
          try {
            return { ...c, count: await probeRepo(c.repo, c.installationId) };
          } catch {
            return null;
          }
        }),
      )
    ).filter((c) => c !== null);
    if (!found.length) return back(installs.length ? "noIndex" : "noInstall");
    let room = MAX_SOURCES - (await userSources(session.user.id)).length;
    let added = 0;
    for (const c of found) {
      const known = existing.some((s) => s.repo.toLowerCase() === c.repo.toLowerCase());
      if (!known && room <= 0) continue;
      await saveSource(session.user.id, c.repo, c.installationId, c.count);
      if (!known) room--;
      added++;
    }
    return back(`connected&n=${added}`);
  } catch (error) {
    console.warn(
      "[x-posts] GitHub connect failed",
      error instanceof GitHubError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : error,
    );
    return back("failed");
  }
}
