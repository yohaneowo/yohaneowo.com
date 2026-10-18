"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Share2Icon } from "lucide-react";
import { localePath } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";

// The own page's "share": /moviehub shows whoever is signed in, so the link to share is the
// public /moviehub/u/<account id>. Phones get the system share sheet; elsewhere it is copied.
export function ShareButton({ userId, name }: { userId: string; name: string }) {
  const { t, lang } = useLocale();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function share() {
    const url = new URL(localePath(lang, `/moviehub/u/${userId}`), window.location.origin).href;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: t.profile.share.title(name), url });
        return;
      } catch (error) {
        // Closing the sheet is not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
      window.prompt(t.profile.share.failed, url);
    }
  }

  return (
    <button
      type="button"
      className="refresh share"
      onClick={share}
      title={t.profile.share.hint}
      aria-label={state === "copied" ? t.profile.share.copied : t.profile.share.label}
    >
      {state === "copied" ? <CheckIcon aria-hidden /> : <Share2Icon aria-hidden />}
      <span aria-hidden>{state === "copied" ? t.profile.share.copied : t.profile.share.label}</span>
    </button>
  );
}
