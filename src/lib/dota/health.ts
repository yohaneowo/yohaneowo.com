import "server-only";
import { freeQuotaSpent, opendotaKeyUntil, opendotaPaidStatus, type PaidStatus } from "./opendota-key";

// How DotaHub's data sources are doing, for the dots in its navigation. Every real call records
// its outcome (and the quota headers it came back with); when a source hasn't been called for a
// while a small probe stands in, at most every PROBE_AFTER_MS so it barely touches the quotas
// (STRATZ's token is shared with admin). Kept in this server process's memory.

export type DotaSource = "opendota" | "stratz" | "steam";
export type HealthState = "ok" | "slow" | "down" | "unknown";
export type SourceHealth = {
  state: HealthState;
  // The latest call: how long it took, and when.
  ms: number | null;
  at: number | null;
  error: string | null;
  // What the source reports as left, e.g. { day: 2784, minute: 59 }.
  quota: Record<string, number>;
  // OpenDota: the free quota is spent, and calls go out with the paid key until then (ms).
  keyUntil?: number | null;
  // OpenDota: the paid key's budget (null without a key).
  paid?: PaidStatus | null;
};

type Sample = { at: number; ok: boolean; ms: number; error: string | null };
// How many calls went to each kind of request since this process started (and how many failed):
// OpenDota by its path with the ids blanked, STRATZ by the function that asked. What eats the
// quotas shows up here, by name.
export type CallCounts = Record<string, { n: number; failed: number }>;

const WINDOW_MS = 5 * 60 * 1000;
const PROBE_AFTER_MS = 3 * 60 * 1000;
const SLOW_MS = 5000;
const KEEP = 20;

const store = ((
  globalThis as {
    __dotaHealth?: {
      samples: Record<DotaSource, Sample[]>;
      quota: Record<DotaSource, Record<string, number>>;
      calls: Record<DotaSource, CallCounts>;
      since: number;
      // When each source was last probed: a probe goes out at most every PROBE_AFTER_MS whatever
      // the samples say (2026-10-24: 118 OpenDota probes in 95 minutes showed up in the counts).
      probedAt?: Record<DotaSource, number>;
    };
  }
).__dotaHealth ??= {
  samples: { opendota: [], stratz: [], steam: [] },
  quota: { opendota: {}, stratz: {}, steam: {} },
  calls: { opendota: {}, stratz: {}, steam: {} },
  since: Date.now(),
  probedAt: { opendota: 0, stratz: 0, steam: 0 },
});
store.probedAt ??= { opendota: 0, stratz: 0, steam: 0 };

// Quota headers per source: header name → the key shown.
const QUOTA_HEADERS: Record<DotaSource, [string, string][]> = {
  opendota: [
    ["x-rate-limit-remaining-day", "day"],
    ["x-rate-limit-remaining-minute", "minute"],
  ],
  stratz: [
    ["x-ratelimit-remaining-day", "day"],
    ["x-ratelimit-remaining-hour", "hour"],
    ["x-ratelimit-remaining-minute", "minute"],
  ],
  steam: [],
};

export function sourceOf(url: string): DotaSource | null {
  const host = new URL(url).host;
  if (host === "api.opendota.com") return "opendota";
  if (host === "api.stratz.com") return "stratz";
  if (host.endsWith("steampowered.com") || host === "www.dota2.com") return "steam";
  return null;
}

// OpenDota's path with the numbers blanked (/players/{id}/matches), without the query.
export function callLabel(url: string) {
  return new URL(url).pathname.replace(/^\/api/, "").replace(/\d{3,}/g, "{id}");
}

export function recordCall(
  source: DotaSource | null,
  started: number,
  outcome: { ok: boolean; error?: string | null; headers?: Headers; label?: string },
) {
  if (!source) return;
  const list = store.samples[source];
  list.push({ at: Date.now(), ok: outcome.ok, ms: Date.now() - started, error: outcome.error ?? null });
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  const count = (store.calls[source][outcome.label ?? "?"] ??= { n: 0, failed: 0 });
  count.n++;
  if (!outcome.ok) count.failed++;
  for (const [header, key] of QUOTA_HEADERS[source]) {
    const value = Number(outcome.headers?.get(header));
    if (outcome.headers?.has(header) && Number.isFinite(value)) store.quota[source][key] = value;
  }
}

// A small request per source that says whether it answers (and, for the APIs with quotas, how much
// is left).
async function probe(source: DotaSource) {
  const started = Date.now();
  store.probedAt![source] = started;
  try {
    let response: Response;
    if (source === "opendota") {
      // Free only: a probe never spends the paid key. A 429 then means the free quota is spent and
      // the site's calls go out with the key, so OpenDota still answers.
      response = await fetch("https://api.opendota.com/api/constants/game_mode", {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (response.status === 429 && process.env.OPENDOTA_API_KEY?.trim()) {
        freeQuotaSpent(response.headers);
        recordCall(source, started, { ok: true, headers: response.headers, label: "probe" });
        return;
      }
    } else if (source === "stratz") {
      const token = process.env.STRATZ_API_TOKEN;
      if (!token) return;
      response = await fetch("https://api.stratz.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          // STRATZ asks API clients to send this exact user agent.
          "User-Agent": "STRATZ_API",
        },
        body: JSON.stringify({ query: "{ constants { gameVersions { id } } }" }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } else {
      response = await fetch("https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/", {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    }
    recordCall(source, started, {
      ok: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      headers: response.headers,
      label: "probe",
    });
  } catch (error) {
    recordCall(source, started, {
      ok: false,
      error: error instanceof Error ? error.name : "failed",
      label: "probe",
    });
  }
}

function summarize(source: DotaSource, now: number): SourceHealth {
  const recent = store.samples[source].filter((s) => now - s.at <= WINDOW_MS);
  const last = store.samples[source].at(-1) ?? null;
  let state: HealthState = "unknown";
  if (last && now - last.at <= WINDOW_MS) {
    if (!last.ok) state = "down";
    else if (recent.some((s) => !s.ok) || last.ms > SLOW_MS) state = "slow";
    else state = "ok";
  }
  return {
    state,
    ms: last?.ms ?? null,
    at: last?.at ?? null,
    error: last && !last.ok ? last.error : null,
    quota: store.quota[source],
    ...(source === "opendota" ? { keyUntil: opendotaKeyUntil() } : {}),
  };
}

let probing: Promise<unknown> | null = null;

// The counts since this process started, by source and kind of request, busiest first.
export function dotaCalls() {
  const sorted = (counts: CallCounts) =>
    Object.fromEntries(Object.entries(counts).sort((a, b) => b[1].n - a[1].n));
  return {
    since: store.since,
    opendota: sorted(store.calls.opendota),
    stratz: sorted(store.calls.stratz),
  };
}

export async function dotaHealth(): Promise<Record<DotaSource, SourceHealth>> {
  const now = Date.now();
  const stale = (["opendota", "stratz", "steam"] as const).filter(
    (source) =>
      now - (store.samples[source].at(-1)?.at ?? 0) > PROBE_AFTER_MS &&
      now - (store.probedAt?.[source] ?? 0) > PROBE_AFTER_MS,
  );
  // One round of probes at a time, however many viewers ask.
  if (stale.length) {
    probing ??= Promise.all(stale.map(probe)).finally(() => (probing = null));
    await probing;
  }
  const at = Date.now();
  return {
    opendota: { ...summarize("opendota", at), paid: await opendotaPaidStatus().catch(() => null) },
    stratz: summarize("stratz", at),
    steam: summarize("steam", at),
  };
}
