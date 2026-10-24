import "server-only";
import { createHmac, createPrivateKey, createSign, timingSafeEqual } from "node:crypto";

// The site's GitHub App, through which TradeHub reads the repos people keep their X posts in
// (lib/coinhub/x-posts-server.ts). Someone installs it on the repos they choose, with Contents
// read-only; the site keeps only the installation id and mints a one-hour token for each read.
// "Request user authorization (OAuth) during installation" is on, so the install comes back with an
// OAuth code that proves who installed it. Env (Doppler):
//   GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET,
//   GITHUB_APP_PRIVATE_KEY (the .pem; "\n" escapes are fine), GITHUB_APP_WEBHOOK_SECRET (optional).
// dev and the live site have one App each (an App sends people back to one callback URL).

const API = "https://api.github.com";
const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "yohaneowo.com",
};

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type AppConfig = {
  appId: string;
  slug: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
};

export function githubApp(): AppConfig | null {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!appId || !slug || !clientId || !clientSecret || !privateKey) return null;
  return { appId, slug, clientId, clientSecret, privateKey };
}

function requireApp() {
  const app = githubApp();
  if (!app) throw new GitHubError("GitHub App is not configured", 503);
  return app;
}

// The App's own JWT (RS256, ten minutes at most; issued a minute early against clock drift).
function appJwt(app: AppConfig) {
  const now = Math.floor(Date.now() / 1000);
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iat: now - 60, exp: now + 540, iss: app.clientId })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(createPrivateKey(app.privateKey));
  return `${unsigned}.${signature.toString("base64url")}`;
}

async function github<T>(path: string, init: RequestInit & { token: string }): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(`${API}${path}`, {
    ...rest,
    headers: { ...HEADERS, Authorization: `Bearer ${token}`, ...(rest.headers as Record<string, string>) },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubError(`GitHub ${path}: HTTP ${response.status}`, response.status);
  return (await response.json()) as T;
}

// Installation tokens by installation id, reused until five minutes before they expire.
const tokens = ((
  globalThis as { __ghInstallTokens?: Map<string, { token: string; until: number }> }
).__ghInstallTokens ??= new Map());

export async function installationToken(installationId: string): Promise<string> {
  const cached = tokens.get(installationId);
  if (cached && cached.until > Date.now()) return cached.token;
  const app = requireApp();
  const result = await github<{ token: string; expires_at: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      token: appJwt(app),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: { contents: "read" } }),
    },
  );
  tokens.set(installationId, { token: result.token, until: Date.parse(result.expires_at) - 5 * 60_000 });
  return result.token;
}

// Forget a token GitHub refused (the installation was removed or narrowed).
export function dropInstallationToken(installationId: string) {
  tokens.delete(installationId);
}

export type UserInstallation = { id: string; account: string; repos: string[] };

// What an OAuth code says: the installations of this App the GitHub user can reach and their
// repos. The user token is used for that and revoked at once (nothing of it is kept).
export async function installationsForCode(code: string, redirectUri: string): Promise<UserInstallation[]> {
  const app = requireApp();
  const exchange = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": HEADERS["User-Agent"],
    },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const grant = (await exchange.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!grant?.access_token) throw new GitHubError(`OAuth exchange: ${grant?.error ?? exchange.status}`, 400);
  const token = grant.access_token;
  try {
    const { installations } = await github<{
      installations: Array<{ id: number; app_id: number; account: { login: string } | null }>;
    }>("/user/installations?per_page=100", { token });
    const mine = installations.filter((i) => String(i.app_id) === app.appId);
    return await Promise.all(
      mine.map(async (i) => {
        const { repositories } = await github<{ repositories: Array<{ full_name: string }> }>(
          `/user/installations/${i.id}/repositories?per_page=100`,
          { token },
        );
        return {
          id: String(i.id),
          account: i.account?.login ?? "",
          repos: repositories.map((r) => r.full_name),
        };
      }),
    );
  } finally {
    // Best effort: the token isn't needed any more.
    fetch(`${API}/applications/${app.clientId}/token`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: token }),
    }).catch(() => {});
  }
}

// Where the install / authorization pages send people back with the code.
export function installUrl(state: string) {
  return `https://github.com/apps/${requireApp().slug}/installations/new?state=${encodeURIComponent(state)}`;
}

export function authorizeUrl(state: string, redirectUri: string) {
  const app = requireApp();
  const query = new URLSearchParams({ client_id: app.clientId, redirect_uri: redirectUri, state });
  return `https://github.com/login/oauth/authorize?${query}`;
}

// A webhook delivery's X-Hub-Signature-256 against the App's webhook secret.
export function verifyWebhook(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET?.trim();
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return (
    expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
}
