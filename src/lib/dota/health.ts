import "server-only";

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
};

type Sample = { at: number; ok: boolean; ms: number; error: string | null };

const WINDOW_MS = 5 * 60 * 1000;
const PROBE_AFTER_MS = 3 * 60 * 1000;
const SLOW_MS = 5000;
const KEEP = 20;

const store = ((
  globalThis as {
    __dotaHealth?: {
      samples: Record<DotaSource, Sample[]>;
      quota: Record<DotaSource, Record<string, number>>;
    };
  }
).__dotaHealth ??= {
  samples: { opendota: [], stratz: [], steam: [] },
  quota: { opendota: {}, stratz: {}, steam: {} },
});

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

export function recordCall(
  source: DotaSource | null,
  started: number,
  outcome: { ok: boolean; error?: string | null; headers?: Headers },
) {
  if (!source) return;
  const list = store.samples[source];
  list.push({ at: Date.now(), ok: outcome.ok, ms: Date.now() - started, error: outcome.error ?? null });
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  for (const [header, key] of QUOTA_HEADERS[source]) {
    const value = Number(outcome.headers?.get(header));
    if (outcome.headers?.has(header) && Number.isFinite(value)) store.quota[source][key] = value;
  }
}

// A small request per source that says whether it answers (and, for the APIs with quotas, how much
// is left).
async function probe(source: DotaSource) {
  const started = Date.now();
  try {
    let response: Response;
    if (source === "opendota") {
      response = await fetch("https://api.opendota.com/api/constants/game_mode", {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
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
    });
  } catch (error) {
    recordCall(source, started, { ok: false, error: error instanceof Error ? error.name : "failed" });
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
  };
}

let probing: Promise<unknown> | null = null;

export async function dotaHealth(): Promise<Record<DotaSource, SourceHealth>> {
  const now = Date.now();
  const stale = (["opendota", "stratz", "steam"] as const).filter(
    (source) => now - (store.samples[source].at(-1)?.at ?? 0) > PROBE_AFTER_MS,
  );
  // One round of probes at a time, however many viewers ask.
  if (stale.length) {
    probing ??= Promise.all(stale.map(probe)).finally(() => (probing = null));
    await probing;
  }
  const at = Date.now();
  return {
    opendota: summarize("opendota", at),
    stratz: summarize("stratz", at),
    steam: summarize("steam", at),
  };
}
