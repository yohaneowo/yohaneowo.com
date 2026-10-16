"use client";

import dynamic from "next/dynamic";
import { Loader2Icon } from "lucide-react";

// KLineChart touches `window` when imported, so the terminal only loads in the browser.
const Terminal = dynamic(() => import("@/components/coinhub/terminal").then((m) => m.Terminal), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function TerminalLoader() {
  return <Terminal />;
}
