import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchDownload, LinkHubUnavailable } from "@/lib/linkhub";

// Streams a file from LinkHub's /v1/download: the gateway adds the right request headers or has
// the upstream tool download it, and its link needs the site's key, so the browser comes here
// instead. Signed-in visitors only (the gateway counts the site's quota, not theirs).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token || token.length > 4096) return NextResponse.json({ error: "badRequest" }, { status: 400 });
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetchDownload(token);
  } catch (error) {
    if (error instanceof LinkHubUnavailable)
      return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
  if (!upstream.ok || !upstream.body) {
    const payload = (await upstream.json().catch(() => null)) as { code?: string } | null;
    return NextResponse.json(
      { error: payload?.code ?? `HTTP ${upstream.status}` },
      { status: upstream.status >= 500 ? 502 : upstream.status },
    );
  }
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-disposition", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Save as: the name the page asked for (an inline image shows up without one).
  const name = url.searchParams.get("name");
  if (name && !headers.has("content-disposition"))
    headers.set(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(name.slice(0, 120))}`,
    );
  headers.set("cache-control", "private, max-age=600");
  return new Response(upstream.body, { status: 200, headers });
}
