import { connection, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { postsForUser } from "@/lib/coinhub/x-posts-server";
import { githubApp } from "@/lib/github-app";

// The signed-in account's X posts and their sources (lib/coinhub/x-posts.ts). Signed out:
// `data: null` (the panel offers to sign in). `app` says whether "connect GitHub" is available.
export async function GET() {
  // Per visitor, at request time (never prerendered).
  await connection();
  const session = await getSession();
  if (!session) return NextResponse.json({ data: null });
  try {
    const { sources, posts } = await postsForUser(session.user.id);
    return NextResponse.json(
      { data: { sources, posts, app: githubApp() !== null } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[x-posts]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
