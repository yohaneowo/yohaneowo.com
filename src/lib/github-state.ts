import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/i18n/config";

// The OAuth `state` for "connect GitHub" (TradeHub X posts): signed, bound to the site account that
// started it, ten minutes long; a cookie carries its nonce, so a state used in another browser is
// refused. Same scheme as lib/trakt-state.ts, without PKCE (GitHub Apps don't use it).
export const GITHUB_STATE_COOKIE = "github_connect";
const TTL_MS = 10 * 60 * 1000;

export interface GitHubState {
  nonce: string;
  userId: string;
  lang: Locale;
  exp: number;
}

function sign(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`github:${payload}`).digest("base64url");
}

export function createGitHubState(input: { userId: string; lang: Locale }) {
  const state: GitHubState = {
    ...input,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, cookie: state.nonce };
}

export function readGitHubState(token: string | null, cookie: string | undefined): GitHubState | null {
  if (!token || !cookie) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
    return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as GitHubState;
    return state.nonce === cookie && state.exp > Date.now() ? state : null;
  } catch {
    return null;
  }
}
