import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/i18n/config";

// The OAuth `state` for "connect Trakt": what the person chose before leaving the site, signed so
// the callback can trust it, bound to their account, and expiring soon. A cookie carries the same
// nonce, so a state pasted into another browser is rejected too.
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
  return { state, token: `${payload}.${sign(payload)}` };
}

// The state from the callback URL, or null when it is forged, expired, or not this browser's.
export function readTraktState(token: string | null, cookieNonce: string | undefined): TraktState | null {
  if (!token || !cookieNonce) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
    return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as TraktState;
    if (state.nonce !== cookieNonce || state.exp < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}
