import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sourceImage } from "@/lib/coinhub/x-posts-server";

// A post's photo or video thumbnail from one of the signed-in account's sources:
// ?s=<source id>&p=<folder>/images/<post id>_<n>.<ext>. The browser keeps it (images don't change).
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const session = await getSession();
  if (!session) return new NextResponse("not found", { status: 404 });
  const path = params.get("p") ?? "";
  const upstream = await sourceImage(session.user.id, params.get("s") ?? "", path);
  if (!upstream) return new NextResponse("not found", { status: 404 });
  const ext = path.split(".").pop()!.toLowerCase();
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      // A post's images never change; an avatar can, so it is kept a day.
      "Cache-Control": /\/avatar\.[a-z]+$/i.test(path)
        ? "private, max-age=86400"
        : "private, max-age=31536000, immutable",
    },
  });
}
