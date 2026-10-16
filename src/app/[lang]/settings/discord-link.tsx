"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LinkIcon, UnlinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";

export function DiscordLink({
  linked,
  configured,
  initialError,
  canUnlink,
}: {
  linked: { id: string; accountId: string } | null;
  configured: boolean;
  initialError: boolean;
  canUnlink: boolean;
}) {
  const router = useRouter();
  const { t, href } = useLocale();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(initialError ? t.settings.linkFailed : "");
  async function change() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = linked
        ? await authClient.unlinkAccount({ accountId: linked.id })
        : await authClient.linkSocial({
            provider: "discord",
            callbackURL: href("/moviehub"),
            errorCallbackURL: href("/settings"),
          });
      if (result.error) {
        setError(t.settings.actionFailed);
        setPending(false);
        return;
      }
      if (linked) {
        setConfirm(false);
        setPending(false);
        router.refresh();
      }
    } catch {
      setError(t.settings.unreachable);
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {linked ? t.settings.linked(linked.accountId) : t.settings.linkHint}
      </p>
      {!configured && !linked && (
        <p role="status" className="text-sm text-muted-foreground">
          {t.settings.notOpen}
        </p>
      )}
      {confirm ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">{t.settings.unlinkWarning}</p>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={pending} onClick={change}>
              {t.settings.confirmUnlink}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>
              {t.settings.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="self-start"
          variant={linked ? "outline" : "default"}
          disabled={pending || (!configured && !linked) || (Boolean(linked) && !canUnlink)}
          onClick={() => (linked ? setConfirm(true) : change())}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : linked ? <UnlinkIcon /> : <LinkIcon />}
          {pending ? t.settings.goingToDiscord : linked ? t.settings.unlink : t.settings.link}
        </Button>
      )}
      {linked && !canUnlink && <p className="text-sm text-muted-foreground">{t.settings.onlyLogin}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
