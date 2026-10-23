"use client";
import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/i18n/locale-provider";
import { saveDotaNotify, saveDotaPrewarm } from "../dotahub/actions";

// Whether the bot DMs the death map after each ranked match (saved on the DotaHub profile in
// admin, which runs the checks), and whether DotaHub pages fetch the other pages' data ahead (a
// cookie of this browser).
export function DotaSettings({ notify, prewarm }: { notify: boolean; prewarm: boolean }) {
  const { t } = useLocale();
  const s = t.dotahub.settings;
  const [on, setOn] = useState(notify);
  const [ahead, setAhead] = useState(prewarm);
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

  function changeAhead(next: boolean) {
    const previous = ahead;
    setAhead(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveDotaPrewarm(next).catch(() => ({ ok: false }));
      if (!result.ok) {
        setAhead(previous);
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="dota-notify">{s.notify}</Label>
          <Switch id="dota-notify" checked={on} disabled={pending} onCheckedChange={change} />
        </div>
        <p className="text-sm text-muted-foreground">{s.hint}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="dota-prewarm">{s.prewarm}</Label>
          <Switch id="dota-prewarm" checked={ahead} disabled={pending} onCheckedChange={changeAhead} />
        </div>
        <p className="text-sm text-muted-foreground">{s.prewarmHint}</p>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {s.saveFailed}
        </p>
      )}
    </div>
  );
}
