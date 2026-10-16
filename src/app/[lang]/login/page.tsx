import type { Metadata } from "next";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { SocialSignInButton } from "./social-sign-in-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).login.title };
}

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

async function LoginContent({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const lang = await getLocale();
  const t = await getDictionary();
  if (session) redirect(localePath(lang, "/"));

  const { error } = await searchParams;
  const code = typeof error === "string" ? error : error?.[0];
  const message = code
    ? code === "access_denied"
      ? t.login.cancelled
      : ["state_not_found", "state_mismatch", "state_expired", "please_restart_the_process"].includes(code)
        ? t.login.expired
        : t.login.incomplete
    : null;

  return (
    <div className="space-y-3">
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <SocialSignInButton provider="google" />
      {process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && (
        <SocialSignInButton provider="discord" />
      )}
    </div>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getDictionary();
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-muted-foreground">
                {t.login.checking}
              </p>
            }
          >
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
