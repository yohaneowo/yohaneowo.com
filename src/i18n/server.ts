import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale } from "./config";
import { DICTIONARIES } from "./dictionaries";

// The current page's language (the [lang] segment); server components and utilities only.
export async function getLocale() {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary() {
  return DICTIONARIES[await getLocale()];
}
