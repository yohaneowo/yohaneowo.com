import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasLocale } from "@/i18n/config";
import { CREDIT_KINDS, type CreditKind } from "@/lib/movie-types";
import { getCreditPart, MoviesUnavailable } from "@/lib/movies";

// The anime credit cards on /moviehub (动画制作, 监督, 原作, 音乐, 总作画监督, 声优), like the
// director card: admin assembles them, this route only checks the visitor is signed in and the
// query looks right. ?part=info gives the head, ?part=works the works so far (the card polls it
// while more is coming).
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
  const kind = query.get("kind") as CreditKind;
  const anilistId = positive(query.get("anilistId"));
  const bangumiId = positive(query.get("bangumiId"));
  const tmdbId = positive(query.get("tmdbId"));
  const name = query.get("name")?.trim() || null;
  const lang = query.get("lang") ?? "zh";
  const part = query.get("part") === "works" ? "works" : "info";
  if (!hasLocale(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (!CREDIT_KINDS.includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  if ([anilistId, bangumiId, tmdbId].some(Number.isNaN) || (name && name.length > 255)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  if (kind === "cast" ? !tmdbId : !anilistId && !bangumiId) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const card = await getCreditPart(part, { kind, anilistId, bangumiId, tmdbId, name }, lang);
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof MoviesUnavailable)
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw error;
  }
}
