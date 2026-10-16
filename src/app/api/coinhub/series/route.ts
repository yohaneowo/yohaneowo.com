import { NextResponse } from "next/server";
import { isIndexId } from "@/lib/coinhub/indices";
import { YAHOO_INTERVALS, getIndexSeries, getYahooSeries, type YahooInterval } from "@/lib/coinhub/server";
import { YAHOO_TICKER } from "../validate";

// Bars for symbols the browser can't fetch itself: market-wide indexes and Yahoo Finance tickers.
// Binance bars come straight from Binance in the browser.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const [prefix, ticker = ""] = (query.get("id") ?? "").split(":");
  try {
    if (prefix === "INDEX" && isIndexId(ticker)) {
      return NextResponse.json(await getIndexSeries(ticker), {
        headers: { "cache-control": "public, max-age=300" },
      });
    }
    if (prefix === "YAHOO" && YAHOO_TICKER.test(ticker)) {
      const interval = query.get("interval") ?? "1d";
      if (!(YAHOO_INTERVALS as readonly string[]).includes(interval)) {
        return NextResponse.json({ error: "bad interval" }, { status: 400 });
      }
      const rawEnd = query.get("end");
      const end = rawEnd ? Number(rawEnd) : null;
      if (end !== null && (!Number.isInteger(end) || end <= 0)) {
        return NextResponse.json({ error: "bad end" }, { status: 400 });
      }
      return NextResponse.json(await getYahooSeries(ticker, interval as YahooInterval, end));
    }
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
