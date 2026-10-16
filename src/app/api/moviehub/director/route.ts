import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasLocale } from "@/i18n/config";
import { getPersonCard, MoviesUnavailable } from "@/lib/movies";

// The director card on /moviehub. Admin looks the person up on TMDB and adds public scores (it
// holds the keys, the caches and the OMDb quota); this route only checks the visitor is signed in.
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams;
  const rawId = query.get("id");
  const name = query.get("name")?.trim() ?? "";
  const id = rawId ? Number(rawId) : undefined;
  const lang = query.get("lang") ?? "zh";
  if (!hasLocale(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (rawId && (!Number.isInteger(id) || !id || id < 1)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  if (!id && (!name || name.length > 255)) {
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  }
  try {
    const card = await getPersonCard(id ? { id } : { name }, lang);
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof MoviesUnavailable)
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw error;
  }
}
