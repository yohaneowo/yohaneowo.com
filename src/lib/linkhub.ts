import "server-only";

// LinkHub (../LinkHub): the link-parsing gateway that routes a link across several open-source
// parsers (yt-dlp, cobalt, XHS-Downloader…) and answers with the post and its media. The site
// calls it only from the server with its own key (LINKHUB_API_KEY, an `internal` role, which
// also gets `downloadUrl`s); the browser never sees the key, and bytes are fetched through
// /api/linkhub/download, which adds the Bearer. The status page uses an admin key.

export class LinkHubUnavailable extends Error {}

export type LinkItemType = "video" | "image" | "audio" | "article";

export interface LinkFormat {
  id?: string;
  quality?: string;
  url: string;
  ext?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  videoCodec?: string;
  audioCodec?: string;
  expiresAt?: string;
  // The gateway's own download link (needs the key); the site turns it into /api/linkhub/download.
  downloadUrl?: string;
  // Set by the site: the path on this site that streams the file.
  download?: string;
}

export interface LinkItem {
  type: LinkItemType;
  id?: string;
  cover?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  // Best quality first.
  formats: LinkFormat[];
}

export interface LinkPost {
  id?: string;
  url: string;
  title?: string;
  text?: string;
  author?: { name?: string; id?: string; handle?: string; avatar?: string; url?: string };
  publishedAt?: string;
  stats?: { likes?: number; comments?: number; shares?: number; views?: number; saves?: number };
}

export interface LinkAttempt {
  adapter: string;
  engine: string;
  code: string;
  message?: string;
  durationMs: number;
}

export interface LinkParseMeta {
  platform: string;
  normalizedUrl: string;
  adapter?: string;
  engine?: string;
  cached: boolean;
  durationMs: number;
  attempts: LinkAttempt[];
  // failed: the direct links don't work from elsewhere; use the download links.
  linkValidation?: "ok" | "failed" | "skipped";
}

export interface LinkParseResult {
  ok: true;
  platform: string;
  post: LinkPost;
  items: LinkItem[];
  meta: LinkParseMeta;
}

export interface LinkParseError {
  ok: false;
  code: string;
  message: string;
  attempts?: LinkAttempt[];
}

export interface LinkPlatform {
  platform: string;
  adapters: number;
  healthy: number;
  engines: string[];
  hosts: string[];
}

export interface LinkAdapterStatus {
  adapter: string;
  engine: string;
  score: number;
  successRate: number;
  p50LatencyMs: number;
  window: number;
  lastCode: string | null;
  lastAt: string | null;
  // closed = fine, open = skipped for a while after repeated failures, half-open = one try allowed.
  breaker: { state: "closed" | "open" | "half-open"; consecutiveFailures: number; openRemainingMs: number };
  healthy: boolean;
  lastProbe: { at: string; ok: boolean; code: string | null } | null;
}

export interface LinkStatus {
  generatedAt: string;
  adapters: Array<{ name: string; engine: string; supportsDownload: boolean }>;
  platforms: Record<
    string,
    {
      healthy: number;
      total: number;
      probeLinks: "configured" | "placeholder" | "disabled";
      lastProbeRun: string | null;
      adapters: LinkAdapterStatus[];
    }
  >;
}

const PARSE_TIMEOUT_MS = 60_000;

function base() {
  const url = process.env.LINKHUB_API_URL?.replace(/\/+$/, "");
  if (!url) throw new LinkHubUnavailable("notConfigured");
  return url;
}

function headers(key: string | undefined) {
  return { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) };
}

export function linkhubConfigured() {
  return Boolean(process.env.LINKHUB_API_URL);
}

// Parses a link. Errors from the gateway come back as `ok: false` with its code; a gateway that
// can't be reached throws LinkHubUnavailable.
export async function parseLink(
  url: string,
  options: { nocache?: boolean } = {},
): Promise<LinkParseResult | LinkParseError> {
  const query = options.nocache ? "?nocache=1" : "";
  let response: Response;
  try {
    response = await fetch(`${base()}/v1/parse${query}`, {
      method: "POST",
      headers: headers(process.env.LINKHUB_API_KEY),
      body: JSON.stringify({ url }),
      cache: "no-store",
      signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof LinkHubUnavailable) throw error;
    throw new LinkHubUnavailable("unreachable");
  }
  const payload = (await response.json().catch(() => null)) as LinkParseResult | LinkParseError | null;
  if (!payload) throw new LinkHubUnavailable("badResponse");
  if (!payload.ok)
    return {
      ok: false,
      code: payload.code ?? "INTERNAL",
      message: payload.message ?? "",
      attempts: payload.attempts,
    };
  return {
    ...payload,
    items: payload.items.map((item) => ({ ...item, formats: item.formats.map(viaSite) })),
  };
}

// A format with the site's own download path in place of the gateway's (the gateway's needs the
// key, which stays on the server).
function viaSite(format: LinkFormat): LinkFormat {
  const token = format.downloadUrl ? new URL(format.downloadUrl).searchParams.get("t") : null;
  const rest: LinkFormat = { ...format };
  delete rest.downloadUrl;
  return token ? { ...rest, download: `/api/linkhub/download?t=${encodeURIComponent(token)}` } : rest;
}

// The gateway's download endpoint for a token, with the key: the site streams its answer through.
export async function fetchDownload(token: string): Promise<Response> {
  try {
    return await fetch(`${base()}/v1/download?t=${encodeURIComponent(token)}`, {
      headers: process.env.LINKHUB_API_KEY ? { Authorization: `Bearer ${process.env.LINKHUB_API_KEY}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(3 * 60_000),
    });
  } catch (error) {
    if (error instanceof LinkHubUnavailable) throw error;
    throw new LinkHubUnavailable("unreachable");
  }
}

export async function listPlatforms(): Promise<LinkPlatform[]> {
  const response = await fetch(`${base()}/v1/platforms`, {
    headers: headers(process.env.LINKHUB_API_KEY),
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new LinkHubUnavailable("unreachable");
  });
  const payload = (await response.json().catch(() => null)) as {
    ok: boolean;
    platforms?: LinkPlatform[];
  } | null;
  if (!payload?.ok || !payload.platforms) throw new LinkHubUnavailable("badResponse");
  return payload.platforms;
}

// The scores, breakers and last probes per platform × adapter (admin key). Adapter URLs are the
// gateway's internal addresses and are left out.
export async function linkhubStatus(): Promise<LinkStatus> {
  const key = process.env.LINKHUB_ADMIN_API_KEY;
  if (!key) throw new LinkHubUnavailable("notConfigured");
  const response = await fetch(`${base()}/admin/status`, {
    headers: headers(key),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new LinkHubUnavailable("unreachable");
  });
  const payload = (await response.json().catch(() => null)) as
    | ({
        ok: boolean;
        adapters?: Array<{ name: string; engine: string; url?: string; supportsDownload: boolean }>;
      } & Omit<LinkStatus, "adapters">)
    | null;
  if (!payload?.ok) throw new LinkHubUnavailable("badResponse");
  return {
    generatedAt: payload.generatedAt,
    adapters: (payload.adapters ?? []).map(({ name, engine, supportsDownload }) => ({
      name,
      engine,
      supportsDownload,
    })),
    platforms: payload.platforms ?? {},
  };
}
