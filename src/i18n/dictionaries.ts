import type { Locale } from "./config";
import en from "./en";
import zh, { type Dictionary } from "./zh";

export type { Dictionary };

// Both are small, so client components import them too (functions can't cross into client props).
export const DICTIONARIES: Record<Locale, Dictionary> = { zh, en };
