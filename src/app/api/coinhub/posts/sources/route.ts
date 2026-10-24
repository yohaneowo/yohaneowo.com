import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  deleteSource,
  MAX_SOURCES,
  parseRepo,
  probeRepo,
  saveSource,
  sourceErrorCode,
  userSources,
} from "@/lib/coinhub/x-posts-server";

// The account's X post sources. POST { repo } adds a public repo (private ones come in through
// "connect GitHub"); DELETE ?id= removes one. Errors are codes the panel words.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "signIn" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { repo?: unknown } | null;
  const repo = typeof body?.repo === "string" ? parseRepo(body.repo) : null;
  if (!repo) return NextResponse.json({ error: "badRepo" }, { status: 400 });
  const existing = await userSources(session.user.id);
  if (existing.length >= MAX_SOURCES && !existing.some((s) => s.repo.toLowerCase() === repo.toLowerCase()))
    return NextResponse.json({ error: "tooMany" }, { status: 400 });
  try {
    const count = await probeRepo(repo, null);
    await saveSource(session.user.id, repo, null, count);
    return NextResponse.json({ data: { repo, count } });
  } catch (error) {
    return NextResponse.json({ error: sourceErrorCode(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "signIn" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "badId" }, { status: 400 });
  await deleteSource(session.user.id, id);
  return NextResponse.json({ data: true });
}
