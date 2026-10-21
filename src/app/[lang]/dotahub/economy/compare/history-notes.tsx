"use client";

import { useLocale } from "@/i18n/locale-provider";
import type { Series } from "./series";

// How much of each compared player's history the comparison has: someone not linked here has only
// STRATZ's newest 100 ranked matches, and a linked player's older matches may still be coming in.
export function HistoryNotes({ sides }: { sides: Series[] }) {
  const t = useLocale().t.dotahub.compare;
  const notes = sides.flatMap((x) =>
    !x.history
      ? []
      : !x.history.stored
        ? [{ key: x.key, color: x.color, text: t.notStored(x.label) }]
        : !x.history.complete
          ? [{ key: x.key, color: x.color, text: t.stillReading(x.label, x.history.count) }]
          : [],
  );
  if (!notes.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {notes.map((n) => (
        <li key={n.key} className="flex items-start gap-1.5">
          <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden />
          {n.text}
        </li>
      ))}
    </ul>
  );
}
