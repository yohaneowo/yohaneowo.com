import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { TradeAdminUnavailable, tradeAdmin, type TradeMethod } from "@/lib/coinhub/trade-admin";

// The terminal's exchange-account API. Every call goes to admin under the signed-in user's id, so a
// request can never name another user's connections; only these paths pass through.
const ALLOWED: Array<[TradeMethod, RegExp]> = [
  ["GET", /^ip$/],
  ["GET", /^connections$/],
  ["POST", /^connections$/],
  ["DELETE", /^connections\/\d+$/],
  ["POST", /^connections\/\d+\/refresh$/],
  ["PUT", /^connections\/\d+\/tracked$/],
  ["GET", /^connections\/\d+\/(balances|fills|income|reconcile)$/],
];

async function proxy(request: Request, method: TradeMethod, params: Promise<{ path: string[] }>) {
  const rel = (await params).path.join("/");
  if (!ALLOWED.some(([m, re]) => m === method && re.test(rel)))
    return NextResponse.json({ error: "notFound" }, { status: 404 });
  const session = await getSession();
  // Signed-out visitors list their connections on every terminal load: that's normal, not an error.
  if (!session && method === "GET" && rel === "connections") return NextResponse.json({ data: null });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  if (method === "POST" || method === "PUT") {
    const text = await request.text();
    if (text.length > 10_000) return NextResponse.json({ error: "tooLarge" }, { status: 413 });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "badJson" }, { status: 400 });
    }
  }
  const target = rel === "ip" ? "/ip" : `/users/${session.user.id}/${rel}${new URL(request.url).search}`;
  try {
    const result = await tradeAdmin(target, method, body);
    if (result.error) {
      const status = result.status >= 400 && result.status < 500 ? result.status : 502;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    if (error instanceof TradeAdminUnavailable)
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw error;
  }
}

type Context = { params: Promise<{ path: string[] }> };

export const GET = (request: Request, context: Context) => proxy(request, "GET", context.params);
export const POST = (request: Request, context: Context) => proxy(request, "POST", context.params);
export const PUT = (request: Request, context: Context) => proxy(request, "PUT", context.params);
export const DELETE = (request: Request, context: Context) => proxy(request, "DELETE", context.params);
