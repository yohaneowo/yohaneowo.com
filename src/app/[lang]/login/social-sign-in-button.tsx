"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";

// next: the site path to land on afterwards (from ?next=); Discord sign-ins default to the movie
// page, since that is what the bot sends people here for.
export function SocialSignInButton({
  provider,
  next = null,
}: {
  provider: "google" | "discord";
  next?: string | null;
}) {
  const label = provider === "google" ? "Google" : "Discord";
  const { t, href } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // Keep the button disabled while the browser leaves for the provider.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: href(next ?? (provider === "discord" ? "/moviehub" : "/")),
        errorCallbackURL: href("/login"),
      });
      if (error) {
        setError(t.login.providerFailed(label));
        setPending(false);
      }
    } catch {
      setError(t.header.authUnreachable);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={signIn} disabled={pending} aria-busy={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? t.login.goingTo(label) : t.login.signInWith(label)}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
