import { connection, NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/coinhub/server";

// The CoinHub market dashboard: sentiment, dominance, Strategy mNAV and derivatives.
export async function GET() {
  // Request time only: building the image must not depend on these upstreams being reachable.
  await connection();
  try {
    return NextResponse.json(await getMarketOverview(), {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
