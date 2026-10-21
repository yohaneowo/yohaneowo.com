"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/locale-provider";

const never = () => () => {};

// A time in the viewer's own time zone. The server doesn't know it, so the first render (and the
// server's) shows UTC and the browser swaps in local time.
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "time" | "date" }) {
  const { lang } = useLocale();
  const local = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions =
    mode === "time"
      ? { hour: "2-digit", minute: "2-digit" }
      : mode === "date"
        ? { month: "short", day: "numeric", weekday: "short" }
        : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  const text = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    ...options,
    timeZone: local ? undefined : "UTC",
  }).format(date);
  return (
    <time dateTime={iso} title={date.toISOString()}>
      {text}
      {!local && " UTC"}
    </time>
  );
}
