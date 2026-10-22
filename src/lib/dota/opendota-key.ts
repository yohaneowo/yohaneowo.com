import "server-only";

// OpenDota's free tier is counted per IP (about 2,000 calls a day and 60 a minute), and everything
// behind this connection shares it: the live site, the dev site, admin, local development. The paid
// key (OPENDOTA_API_KEY, billed per call) is only the fallback: a call goes out free, and when the
// free quota is spent (429) it's sent again with the key — as is every OpenDota call after it until
// the free quota is back (the next minute, or the next UTC day when the day's is gone). Meanwhile
// one call every 10 minutes tries the free tier first, so the key stops as soon as it isn't needed.
// Kept in this server process's memory.

const RECHECK_MS = 10 * 60 * 1000;

const state = globalThis as { __opendotaKeyUntil?: number; __opendotaFreeTried?: number };

// Trimmed: a value piped into Doppler may end with a newline, which a header can't carry.
const apiKey = () => process.env.OPENDOTA_API_KEY?.trim() || null;

const nextUtcDay = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
};

// Whether calls go out with the key now (the free quota is spent), and until when.
export function opendotaKeyUntil(): number | null {
  const until = state.__opendotaKeyUntil ?? 0;
  return apiKey() && Date.now() < until ? until : null;
}

// A 429 from the free tier: until when to use the key instead.
export function freeQuotaSpent(headers: Headers) {
  const day = Number(headers.get("x-rate-limit-remaining-day"));
  state.__opendotaKeyUntil =
    headers.has("x-rate-limit-remaining-day") && day <= 0 ? nextUtcDay() : Date.now() + 60_000;
}

// A request to OpenDota, free first and with the key when the free quota is spent. `init` is called
// for each attempt, so each gets its own timeout. The key goes in a header, never in the URL (URLs
// end up in logs).
export async function opendotaFetch(url: string, init: () => RequestInit = () => ({})): Promise<Response> {
  const key = apiKey();
  const withKey = () => {
    const options = init();
    return fetch(url, {
      ...options,
      headers: { ...(options.headers as Record<string, string> | undefined), Authorization: `Bearer ${key}` },
    });
  };
  if (key && opendotaKeyUntil() && Date.now() - (state.__opendotaFreeTried ?? 0) < RECHECK_MS)
    return withKey();
  state.__opendotaFreeTried = Date.now();
  const response = await fetch(url, init());
  if (response.status !== 429 || !key) {
    // The free tier answers again.
    if (response.ok) state.__opendotaKeyUntil = 0;
    return response;
  }
  freeQuotaSpent(response.headers);
  return withKey();
}
