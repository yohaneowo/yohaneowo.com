import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/i18n/config";

// The OAuth `state` for "connect Trakt": what the person chose before leaving the site, signed so
// the callback can trust it, bound to their account, and expiring soon. A cookie carries the same
// nonce plus the PKCE verifier (Trakt requires PKCE), so a state pasted into another browser is
// rejected and the verifier never travels through Trakt.
export const TRAKT_STATE_COOKIE = "trakt_connect";
const TTL_MS = 10 * 60 * 1000;

export interface TraktState {
  nonce: string;
  userId: string;
  region: string;
  lang: Locale;
  exp: number;
}

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createTraktState(input: { userId: string; region: string; lang: Locale }) {
  const state: TraktState = {
    ...input,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  // PKCE: the verifier stays in the cookie, its S256 hash goes to Trakt with the authorization.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, token: `${payload}.${sign(payload)}`, cookie: `${state.nonce}.${verifier}`, challenge };
}

// The state from the callback URL with the verifier from the cookie, or null when the state is
// forged, expired, or not this browser's.
export function readTraktState(
  token: string | null,
  cookie: string | undefined,
): (TraktState & { verifier: string }) | null {
  if (!token || !cookie) return null;
  const [payload, signature] = token.split(".");
  const [cookieNonce, verifier] = cookie.split(".");
  if (!payload || !signature || !cookieNonce || !verifier) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
    return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as TraktState;
    if (state.nonce !== cookieNonce || state.exp < Date.now()) return null;
    return { ...state, verifier };
  } catch {
    return null;
  }
}
