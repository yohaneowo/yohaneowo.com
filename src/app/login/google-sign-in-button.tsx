"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton({ initialError }: { initialError: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function signIn() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // Keep the button disabled while the browser leaves for Google.
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/login",
      });
      if (error) {
        setError("暂时无法使用 Google 登录，请稍后再试。");
        setPending(false);
      }
    } catch {
      setError("无法连接登录服务，请检查网络后重试。");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={signIn} disabled={pending} aria-busy={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "正在前往 Google…" : "使用 Google 登录"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
