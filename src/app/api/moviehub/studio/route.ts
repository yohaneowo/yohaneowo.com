import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasLocale } from "@/i18n/config";
import { getStudioPart, MoviesUnavailable } from "@/lib/movies";

// The studio card on /moviehub (anime 动画制作), like the director card: admin assembles it,
// this route only checks the visitor is signed in and the IDs look right. ?part=info gives the
// head, ?part=works the works so far (the card polls it while more is coming).
function positive(value: string | null) {
  if (value == null) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams;
  const anilistId = positive(query.get("anilistId"));
  const bangumiId = positive(query.get("bangumiId"));
  const lang = query.get("lang") ?? "zh";
  const part = query.get("part") === "works" ? "works" : "info";
  if (!hasLocale(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (Number.isNaN(anilistId) || Number.isNaN(bangumiId) || (!anilistId && !bangumiId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const card = await getStudioPart(part, { anilistId, bangumiId }, lang);
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof MoviesUnavailable)
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw error;
  }
}
