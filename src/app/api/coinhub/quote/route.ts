import { NextResponse } from "next/server";
import { isIndexId } from "@/lib/coinhub/indices";
import { getIndexQuote, getYahooQuote, type Quote } from "@/lib/coinhub/server";
import { YAHOO_TICKER } from "../validate";

// Latest price and daily change for Yahoo tickers and indexes (`?ids=YAHOO:MSTR,INDEX:BTC.D`).
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, Quote | null]> => {
      const [prefix, ticker = ""] = id.split(":");
      try {
        if (prefix === "INDEX" && isIndexId(ticker)) return [id, await getIndexQuote(ticker)];
        if (prefix === "YAHOO" && YAHOO_TICKER.test(ticker)) return [id, await getYahooQuote(ticker)];
      } catch {
        // Leave this one out.
      }
      return [id, null];
    }),
  );
  return NextResponse.json(Object.fromEntries(entries.filter(([, q]) => q)));
}
