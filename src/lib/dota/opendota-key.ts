import "server-only";
import { keep, kept } from "./kept";

// OpenDota's free tier is counted per IP (about 2,000 calls a day and 60 a minute), and everything
// behind this connection shares it: the live site, the dev site, admin, local development. The paid
// key (OPENDOTA_API_KEY, billed per call) is only the fallback: a call goes out free, and when the
// free quota is spent (429) it's sent again with the key — as is every OpenDota call after it until
// the free quota is back (the next minute, or the next UTC day when the day's is gone). Meanwhile
// one call every 10 minutes tries the free tier first, so the key stops as soon as it isn't needed.
//
// The key has a budget: OPENDOTA_PAID_DAILY_CAP and OPENDOTA_PAID_MONTHLY_CAP calls (UTC days and
// months; $1 buys 10,000). Once either is reached the key stays in the drawer and calls go out
// free only, which fails while the free quota is spent — the pages then show their "unavailable"
// notices instead of the card being charged. The counts are kept in the database (dota_snapshot,
// key "opendota-paid"), so a deploy doesn't reset them; each site (live, dev) counts its own.

const RECHECK_MS = 10 * 60 * 1000;
const DEFAULT_DAILY_CAP = 3000;
const DEFAULT_MONTHLY_CAP = 30_000;
const PAID_KEY = "opendota-paid";
// How often the counts are written back at most.
const SAVE_EVERY_MS = 10_000;

type Paid = { day: string; today: number; month: string; monthTotal: number };

const state = globalThis as {
  __opendotaKeyUntil?: number;
  __opendotaFreeTried?: number;
  __opendotaPaid?: Paid;
  __opendotaPaidLoaded?: Promise<void>;
  __opendotaPaidSavedAt?: number;
  __opendotaPaidDirty?: boolean;
};

// Trimmed: a value piped into Doppler may end with a newline, which a header can't carry.
const apiKey = () => process.env.OPENDOTA_API_KEY?.trim() || null;

const nextUtcDay = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
};

const utcDay = () => new Date().toISOString().slice(0, 10);
const utcMonth = () => utcDay().slice(0, 7);

function cap(name: "OPENDOTA_PAID_DAILY_CAP" | "OPENDOTA_PAID_MONTHLY_CAP", fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

// The counts for today and this month (rolled over when the UTC day or month changed).
function paid(): Paid {
  const p = (state.__opendotaPaid ??= { day: utcDay(), today: 0, month: utcMonth(), monthTotal: 0 });
  if (p.day !== utcDay()) Object.assign(p, { day: utcDay(), today: 0 });
  if (p.month !== utcMonth()) Object.assign(p, { month: utcMonth(), monthTotal: 0 });
  return p;
}

// The counts from the database, once per process; a count already made here is never lowered.
function loadPaid() {
  return (state.__opendotaPaidLoaded ??= kept<Paid>(PAID_KEY)
    .then((row) => {
      if (!row) return;
      const p = paid();
      if (row.data.day === p.day) p.today = Math.max(p.today, row.data.today);
      if (row.data.month === p.month) p.monthTotal = Math.max(p.monthTotal, row.data.monthTotal);
    })
    .catch(() => {}));
}

function savePaid(force = false) {
  const now = Date.now();
  if (!force && now - (state.__opendotaPaidSavedAt ?? 0) < SAVE_EVERY_MS) {
    state.__opendotaPaidDirty = true;
    return;
  }
  state.__opendotaPaidSavedAt = now;
  state.__opendotaPaidDirty = false;
  void keep(PAID_KEY, { ...paid() }).catch(() => {});
}

// What the budget looks like now, for the health endpoint and the navigation's dots.
export type PaidStatus = {
  today: number;
  month: number;
  dailyCap: number;
  monthlyCap: number;
  // The key is in the drawer: a cap is reached (or there is no key).
  capped: boolean;
};

export async function opendotaPaidStatus(): Promise<PaidStatus | null> {
  if (!apiKey()) return null;
  await loadPaid();
  const p = paid();
  const dailyCap = cap("OPENDOTA_PAID_DAILY_CAP", DEFAULT_DAILY_CAP);
  const monthlyCap = cap("OPENDOTA_PAID_MONTHLY_CAP", DEFAULT_MONTHLY_CAP);
  return {
    today: p.today,
    month: p.monthTotal,
    dailyCap,
    monthlyCap,
    capped: p.today >= dailyCap || p.monthTotal >= monthlyCap,
  };
}

// Whether a cap is reached, from the counts in memory (no await: checked right before a call is
// counted, so concurrent calls can't all slip through together).
function isCapped() {
  const p = paid();
  return (
    p.today >= cap("OPENDOTA_PAID_DAILY_CAP", DEFAULT_DAILY_CAP) ||
    p.monthTotal >= cap("OPENDOTA_PAID_MONTHLY_CAP", DEFAULT_MONTHLY_CAP)
  );
}

// One call went out with the key.
function paidUsed() {
  const p = paid();
  p.today++;
  p.monthTotal++;
  const status = {
    dailyCap: cap("OPENDOTA_PAID_DAILY_CAP", DEFAULT_DAILY_CAP),
    monthlyCap: cap("OPENDOTA_PAID_MONTHLY_CAP", DEFAULT_MONTHLY_CAP),
  };
  // Reaching a cap is worth writing at once; the rest is batched.
  savePaid(p.today === status.dailyCap || p.monthTotal === status.monthlyCap);
  if (state.__opendotaPaidDirty) setTimeout(() => state.__opendotaPaidDirty && savePaid(true), SAVE_EVERY_MS);
}

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

// A request to OpenDota, free first and with the key when the free quota is spent (and the budget
// allows). `init` is called for each attempt, so each gets its own timeout. The key goes in a
// header, never in the URL (URLs end up in logs).
export async function opendotaFetch(url: string, init: () => RequestInit = () => ({})): Promise<Response> {
  const key = apiKey();
  // Counted before it goes out, in the same tick as the cap check.
  const withKey = () => {
    const options = init();
    paidUsed();
    return fetch(url, {
      ...options,
      headers: { ...(options.headers as Record<string, string> | undefined), Authorization: `Bearer ${key}` },
    });
  };
  if (key && opendotaKeyUntil() && Date.now() - (state.__opendotaFreeTried ?? 0) < RECHECK_MS) {
    await loadPaid();
    if (!isCapped()) return withKey();
  }
  state.__opendotaFreeTried = Date.now();
  const response = await fetch(url, init());
  if (response.status !== 429 || !key) {
    // The free tier answers again.
    if (response.ok) state.__opendotaKeyUntil = 0;
    return response;
  }
  freeQuotaSpent(response.headers);
  await loadPaid();
  // Over budget: the free tier's 429 stands, and the page shows its notice.
  if (isCapped()) return response;
  return withKey();
}
