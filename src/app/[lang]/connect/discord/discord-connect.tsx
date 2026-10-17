"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/locale-provider";
import { authClient } from "@/lib/auth-client";

type Mode = "signIn" | "link" | "done";

export function DiscordConnect({ mode }: { mode: Mode }) {
  const { t, href } = useLocale();
  const params = useSearchParams();
  const [failed, setFailed] = useState(Boolean(params.get("error")));
  const started = useRef(false);

  // Start Discord's authorization as soon as the page shows; the person only confirms on Discord.
  useEffect(() => {
    if (mode === "done" || failed || started.current) return;
    started.current = true;
    const target = href("/moviehub");
    const errorTarget = href("/connect/discord?error=1");
    const run =
      mode === "signIn"
        ? authClient.signIn.social({
            provider: "discord",
            callbackURL: target,
            errorCallbackURL: errorTarget,
          })
        : authClient.linkSocial({ provider: "discord", callbackURL: target, errorCallbackURL: errorTarget });
    run.then((result) => {
      if (result.error) setFailed(true);
    });
  }, [mode, failed, href]);

  const c = t.connect;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>
          {mode === "done" ? c.alreadyLinked : mode === "link" ? c.linking : c.signingIn}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {mode === "link" ? c.linkFailed : c.signInFailed}
            </p>
            <Button
              onClick={() => {
                started.current = false;
                setFailed(false);
              }}
            >
              {c.retry}
            </Button>
          </>
        ) : mode === "done" ? (
          <Link href={href("/moviehub")} className={buttonVariants()}>
            {c.goToMovies}
          </Link>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {c.working}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
