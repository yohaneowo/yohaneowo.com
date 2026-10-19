"use client";
import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/i18n/locale-provider";
import { saveDotaNotify } from "../dotahub/actions";

// Whether the bot DMs the death map after each ranked match. Saved on the DotaHub profile in
// admin, which runs the checks.
export function DotaSettings({ notify }: { notify: boolean }) {
  const { t } = useLocale();
  const s = t.dotahub.settings;
  const [on, setOn] = useState(notify);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    const previous = on;
    setOn(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveDotaNotify(next).catch(() => ({ ok: false }));
      if (!result.ok) {
        setOn(previous);
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dota-notify">{s.notify}</Label>
        <Switch id="dota-notify" checked={on} disabled={pending} onCheckedChange={change} />
      </div>
      <p className="text-sm text-muted-foreground">{s.hint}</p>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {s.saveFailed}
        </p>
      )}
    </div>
  );
}
