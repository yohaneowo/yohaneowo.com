import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata: Metadata = { title: "登录" };

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

async function LoginContent({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) redirect("/");

  const { error } = await searchParams;
  const code = typeof error === "string" ? error : error?.[0];
  const message = code
    ? code === "access_denied"
      ? "你取消了 Google 授权，可以重新尝试登录。"
      : ["state_not_found", "state_mismatch", "state_expired", "please_restart_the_process"].includes(code)
        ? "登录请求已失效，请重新登录。"
        : "Google 登录未完成，请重试。若仍失败，请稍后再试。"
    : null;

  return <GoogleSignInButton initialError={message} />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>用 Google 帐号登录，首次登录会自动创建网站帐号。</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-muted-foreground">
                正在检查登录状态…
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
