"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { askToParse, disconnectSteam } from "./actions";

export function DisconnectSteam() {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.dotahub.connect.unlinkConfirm)) return;
        startTransition(async () => {
          await disconnectSteam();
        });
      }}
    >
      {t.dotahub.connect.unlink}
    </Button>
  );
}

export function RequestParse({ matchId }: { matchId: number }) {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  if (state === "sent")
    return <p className="text-sm text-muted-foreground">{t.dotahub.match.parseRequested}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await askToParse(matchId);
            setState(result.ok ? "sent" : "failed");
          })
        }
      >
        {t.dotahub.match.requestParse}
      </Button>
      {state === "failed" && <p className="text-sm text-destructive">{t.dotahub.match.parseFailed}</p>}
    </div>
  );
}
