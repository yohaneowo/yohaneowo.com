"use client";

import { useLocale } from "@/i18n/locale-provider";
import type { Series } from "./series";
import { FullHistoryLink } from "../../full-history";

// How much of each compared player's history the comparison has: someone not linked here has only
// STRATZ's newest 100 ranked matches, and a linked player's older matches may still be coming in.
export function HistoryNotes({ sides }: { sides: Series[] }) {
  const t = useLocale().t.dotahub.compare;
  // account: someone whose whole history can still be asked for (读取全部).
  type Note = { key: string; color: string; text: string; account: number | null };
  const notes = sides.flatMap<Note>((x) =>
    !x.history
      ? []
      : !x.history.stored
        ? [{ key: x.key, color: x.color, text: t.notStored(x.label), account: x.history.accountId }]
        : !x.history.complete
          ? [{ key: x.key, color: x.color, text: t.stillReading(x.label, x.history.count), account: null }]
          : [],
  );
  if (!notes.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {notes.map((n) => (
        <li key={n.key} className="flex items-start gap-1.5">
          <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden />
          <span>
            {n.text} {n.account ? <FullHistoryLink accountId={n.account} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
