import { NextResponse } from "next/server";
import { getFxRates, getSpotPrices, getYahooQuote } from "@/lib/coinhub/server";

// USD prices for wallet assets (`?assets=BTC,ETH,EQ_MSTR`) and USD exchange rates, for the account
// panel's total. Coins are priced on Binance spot (against USDT, else USDC, else through BTC),
// stocks (EQ_<ticker>) on Yahoo; stablecoins count as a dollar. Public market data, cached upstream.
const ASSET = /^[A-Z0-9_]{1,20}$/;
const STABLES = new Set(["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "USDP", "USD1"]);

export async function GET(request: Request) {
  const assets = [
    ...new Set(
      (new URL(request.url).searchParams.get("assets") ?? "")
        .split(",")
        .filter((a) => ASSET.test(a))
        .slice(0, 200),
    ),
  ];
  const [spot, fx] = await Promise.all([
    getSpotPrices().catch(() => ({}) as Record<string, number>),
    getFxRates().catch(() => null),
  ]);
  const prices: Record<string, number> = {};
  await Promise.all(
    assets.map(async (asset) => {
      if (STABLES.has(asset)) {
        prices[asset] = 1;
      } else if (asset.startsWith("EQ_")) {
        const quote = await getYahooQuote(asset.slice(3)).catch(() => null);
        if (quote) prices[asset] = quote.last;
      } else {
        const viaBtc = spot[`${asset}BTC`] && spot.BTCUSDT ? spot[`${asset}BTC`] * spot.BTCUSDT : undefined;
        const price = spot[`${asset}USDT`] ?? spot[`${asset}USDC`] ?? viaBtc;
        if (price) prices[asset] = price;
      }
    }),
  );
  return NextResponse.json({ prices, rates: fx?.rates ?? { USD: 1 }, ratesAt: fx?.at ?? null });
}
