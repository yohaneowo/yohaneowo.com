import { NextResponse } from "next/server";
import { searchYahoo } from "@/lib/coinhub/server";

// Stocks, ETFs and indexes from Yahoo Finance for the symbol search (crypto is searched client-side).
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 40) return NextResponse.json([]);
  try {
    return NextResponse.json(await searchYahoo(q.toLowerCase()));
  } catch {
    return NextResponse.json([]);
  }
}
