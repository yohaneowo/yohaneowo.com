"use client";
import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/i18n/locale-provider";
import { saveAnimeAiring } from "./actions";

// /anime recommend's airing switch: whether this season's airing anime are among the picks. The
// value lives on the movie profile in admin (where the picks are made), so it is saved there.
export function AnimeSettings({ airing }: { airing: boolean }) {
  const { t } = useLocale();
  const a = t.settings.anime;
  const [on, setOn] = useState(airing);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    const previous = on;
    setOn(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveAnimeAiring(next).catch(() => ({ error: "saveFailed" as const }));
      if (result.error) {
        setOn(previous);
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="anime-airing">{a.airing}</Label>
        <Switch id="anime-airing" checked={on} disabled={pending} onCheckedChange={change} />
      </div>
      <p className="text-sm text-muted-foreground">{a.airingHint}</p>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {a.saveFailed}
        </p>
      )}
    </div>
  );
}
