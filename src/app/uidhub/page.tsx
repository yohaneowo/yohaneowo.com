import type { Metadata } from "next";
import { Gamepad2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "UIDHub" };

export default function UidHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">UIDHub</h1>
        <p className="text-muted-foreground">
          把你在各个游戏的 UID 放在一个公开页面，别人想加好友时直接看，不用你开游戏查。
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Gamepad2Icon className="size-8" />
          <p>功能还在搭建中。</p>
        </CardContent>
      </Card>
    </div>
  );
}
