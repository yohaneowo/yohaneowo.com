import type { Metadata } from "next";
import { Gamepad2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/i18n/server";

export const metadata: Metadata = { title: "UidHub" };

export default async function UidHubPage() {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">UidHub</h1>
        <p className="text-muted-foreground">{t.uidhub.description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Gamepad2Icon className="size-8" />
          <p>{t.uidhub.building}</p>
        </CardContent>
      </Card>
    </div>
  );
}
