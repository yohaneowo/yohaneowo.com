import { NextResponse } from "next/server";
import { canSeeXPosts, fetchRepoFile } from "@/lib/coinhub/x-posts-server";

// A post's photo or video thumbnail from the private x-monitor repo: <folder>/images/<id>_<n>.<ext>.
// Only those paths pass, only for viewers; the browser keeps it (a post's images never change).
const PATH = /^[a-z0-9_]{1,40}\/images\/\d{5,25}_\d{1,2}\.(jpg|jpeg|png|webp|gif)$/i;
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("p") ?? "";
  if (!PATH.test(path)) return new NextResponse("not found", { status: 404 });
  if (!(await canSeeXPosts())) return new NextResponse("not found", { status: 404 });
  const upstream = await fetchRepoFile(path).catch(() => null);
  if (!upstream?.ok || !upstream.body)
    return new NextResponse("not found", { status: upstream?.status === 404 ? 404 : 502 });
  const ext = path.split(".").pop()!.toLowerCase();
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
