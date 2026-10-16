// Regions a movie profile can pick as "where I watch" (TMDB's cinema listings are per country):
// every ISO 3166-1 country Intl knows, named for the interface language. Mirrors the bot's
// services/movies/regions.js so both sides accept the same codes.

const PRIORITY = ["TW", "MY", "JP", "HK", "MO", "SG", "KR", "CN", "US", "GB", "CA", "AU"];
// Codes Intl knows that aren't countries (or have no cinema listings of their own).
const EXCLUDED = new Set(["EU", "EZ", "UN", "ZZ", "QO", "XA", "XB", "AC", "CP", "DG", "EA", "IC", "TA"]);
// Shorter than Intl's official names ("中国香港特别行政区").
const SHORT_NAMES: Record<string, Record<string, string>> = { zh: { HK: "香港", MO: "澳门" } };

const CODES: string[] = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const out: string[] = [];
  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second);
      if (!EXCLUDED.has(code) && names.of(code)) out.push(code);
    }
  }
  return out;
})();

const CODE_SET = new Set(CODES);

export function isRegionCode(value: string): boolean {
  return CODE_SET.has(value);
}

export interface Region {
  code: string;
  name: string;
}

// Sorted with the regions most people here pick first, then alphabetically by name.
export function listRegions(lang: "zh" | "en"): Region[] {
  const names = new Intl.DisplayNames([lang === "zh" ? "zh-Hans" : "en"], {
    type: "region",
    fallback: "none",
  });
  const rank = (code: string) => (PRIORITY.includes(code) ? PRIORITY.indexOf(code) : PRIORITY.length);
  return CODES.map((code) => ({ code, name: SHORT_NAMES[lang]?.[code] ?? names.of(code) ?? code })).sort(
    (a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, lang === "zh" ? "zh-Hans" : "en"),
  );
}
