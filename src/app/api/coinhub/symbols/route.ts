import { NextResponse } from "next/server";
import { INDEX_SYMBOLS, isIndexId, indexSymbol } from "@/lib/coinhub/indices";
import { getBinanceSymbols, getYahooSymbol } from "@/lib/coinhub/server";
import { YAHOO_TICKER } from "../validate";

// Every chartable symbol except Yahoo's (those are searched on demand); `?id=` resolves one.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (id) {
      const [prefix, ticker = ""] = id.split(":");
      if (prefix === "INDEX" && isIndexId(ticker)) return NextResponse.json(indexSymbol(ticker));
      if (prefix === "YAHOO" && YAHOO_TICKER.test(ticker))
        return NextResponse.json(await getYahooSymbol(ticker));
      if (prefix === "BINANCE") {
        const symbol = (await getBinanceSymbols()).find((s) => s.id === id);
        if (symbol) return NextResponse.json(symbol);
      }
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const binance = await getBinanceSymbols();
    return NextResponse.json([...binance, ...INDEX_SYMBOLS], {
      headers: { "cache-control": "public, max-age=600" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
