import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { coinhubWorkspace } from "@/db/schema";
import { getSession } from "@/lib/auth";

// The signed-in user's CoinHub workspace (layout, drawings, alerts, paper account).
const MAX_BYTES = 2_000_000;

export async function GET() {
  const session = await getSession();
  // Signed-out visitors are normal here, so not an error status.
  if (!session) return NextResponse.json({ signedIn: false });
  const [row] = await db
    .select({ data: coinhubWorkspace.data, updatedAt: coinhubWorkspace.updatedAt })
    .from(coinhubWorkspace)
    .where(eq(coinhubWorkspace.userId, session.user.id))
    .limit(1);
  return NextResponse.json({
    signedIn: true,
    data: row?.data ?? null,
    updatedAt: row?.updatedAt.getTime() ?? 0,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "bad workspace" }, { status: 400 });
  }
  const [row] = await db
    .insert(coinhubWorkspace)
    .values({ userId: session.user.id, data })
    .onConflictDoUpdate({ target: coinhubWorkspace.userId, set: { data, updatedAt: new Date() } })
    .returning({ updatedAt: coinhubWorkspace.updatedAt });
  return NextResponse.json({ updatedAt: row.updatedAt.getTime() });
}
