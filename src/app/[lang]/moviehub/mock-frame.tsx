import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/i18n/server";

// The frame of a mock-up page: title, what the feature would do, and a note that the data is made up.
export async function MockFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <Badge variant="outline">{t.moviehub.mock.badge}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t.moviehub.mock.note}
      </p>
      {children}
    </div>
  );
}
