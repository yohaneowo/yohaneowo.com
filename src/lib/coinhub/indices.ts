import type { CoinSymbol } from "./types";

// Market-wide series computed by /api/coinhub/series. All daily; the chart resamples to 1W / 1M.
export const INDEX_IDS = [
  "BTC.D",
  "ETH.D",
  "USDT.D",
  "USDC.D",
  "STABLE.D",
  "TOTAL",
  "TOTAL2",
  "TOTAL3",
  "STABLE.C",
  "FEAR.GREED",
  "MSTR.MNAV",
  "MSTR.MNAV.NET",
  "MSTR.MNAV.EV",
  "BTC.AHR999",
  "BTC.MAYER",
] as const;

export type IndexId = (typeof INDEX_IDS)[number];

const DESCRIPTIONS: Record<IndexId, [string, number]> = {
  "BTC.D": ["Bitcoin dominance, %", 2],
  "ETH.D": ["Ethereum dominance, %", 2],
  "USDT.D": ["Tether dominance, %", 2],
  "USDC.D": ["USD Coin dominance, %", 2],
  "STABLE.D": ["Stablecoin (USDT + USDC) dominance, %", 2],
  TOTAL: ["Crypto total market cap, $", 0],
  TOTAL2: ["Crypto total market cap excluding BTC, $", 0],
  TOTAL3: ["Crypto total market cap excluding BTC and ETH, $", 0],
  "STABLE.C": ["Stablecoin (USDT + USDC) market cap, $", 0],
  "FEAR.GREED": ["Crypto Fear & Greed Index", 0],
  "MSTR.MNAV": ["Strategy (MSTR) market-cap mNAV, estimated", 3],
  "MSTR.MNAV.NET": ["Strategy (MSTR) mNAV net of debt and preferred, cebetracker.io", 3],
  "MSTR.MNAV.EV": ["Strategy (MSTR) enterprise-value mNAV, cebetracker.io", 3],
  "BTC.AHR999": ["AHR999 index (BTC accumulation)", 3],
  "BTC.MAYER": ["Mayer multiple (BTC / 200-day MA)", 3],
};

// Extra search terms (TradingView matches descriptions too; these add the words people type).
const KEYWORDS: Partial<Record<IndexId, string[]>> = {
  "BTC.D": ["btcd", "dominance", "市占", "主导", "比特币"],
  "ETH.D": ["ethd", "dominance", "市占", "主导", "以太坊"],
  "USDT.D": ["usdtd", "tether", "dominance", "稳定币", "市占"],
  "USDC.D": ["usdcd", "dominance", "稳定币"],
  "STABLE.D": ["stablecoin", "dominance", "稳定币"],
  TOTAL: ["market cap", "总市值"],
  TOTAL2: ["market cap", "总市值", "山寨"],
  TOTAL3: ["market cap", "总市值", "山寨"],
  "STABLE.C": ["stablecoin", "稳定币", "市值"],
  "FEAR.GREED": ["fng", "fear", "greed", "sentiment", "恐惧", "贪婪", "情绪"],
  "MSTR.MNAV": ["mstr", "strategy", "microstrategy", "mnav", "微策略"],
  "MSTR.MNAV.NET": ["mstr", "strategy", "microstrategy", "mnav", "微策略", "净"],
  "MSTR.MNAV.EV": ["mstr", "strategy", "microstrategy", "mnav", "微策略", "企业价值", "ev"],
  "BTC.AHR999": ["ahr", "ahr999", "囤币", "比特币"],
  "BTC.MAYER": ["mayer", "梅耶", "比特币"],
};

export function isIndexId(value: string): value is IndexId {
  return (INDEX_IDS as readonly string[]).includes(value);
}

export function indexSymbol(id: IndexId): CoinSymbol {
  const [description, pricePrecision] = DESCRIPTIONS[id];
  return {
    id: `INDEX:${id}`,
    source: "index",
    ticker: id,
    display: id,
    description,
    exchange: "TradeHub",
    kind: "index",
    pricePrecision,
    volumePrecision: 0,
    keywords: KEYWORDS[id],
  };
}

export const INDEX_SYMBOLS: CoinSymbol[] = INDEX_IDS.map(indexSymbol);
