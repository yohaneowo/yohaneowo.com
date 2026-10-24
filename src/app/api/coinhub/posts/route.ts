import { connection, NextResponse } from "next/server";
import { canSeeXPosts, getXPosts } from "@/lib/coinhub/x-posts-server";

// The X posts for the terminal's chart marks (lib/coinhub/x-posts.ts). Visitors who aren't viewers
// get `data: null` (not an error: the terminal asks on every load and just leaves the feature out).
export async function GET() {
  // Per visitor, at request time: without this the route is prerendered (no token, no session at
  // build) and answers null forever.
  await connection();
  if (!(await canSeeXPosts())) return NextResponse.json({ data: null });
  try {
    return NextResponse.json(
      { data: await getXPosts() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[x-posts]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
