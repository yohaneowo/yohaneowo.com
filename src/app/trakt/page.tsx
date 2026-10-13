import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingChart } from "./rating-chart";

export const metadata: Metadata = { title: "观影统计" };

export default function TraktPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">观影统计</h1>
        <p className="text-muted-foreground">登录后根据你的 Trakt 观看记录生成口味统计。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            评分分布 <Badge variant="secondary">示例数据</Badge>
          </CardTitle>
          <CardDescription>还没接上资料来源，先用假数据确认图表能正常显示。</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <RatingChart />
        </CardContent>
      </Card>
    </div>
  );
}
