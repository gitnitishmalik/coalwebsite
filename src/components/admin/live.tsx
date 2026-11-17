"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { AnimatedList } from "@/components/ui/animated-list";
import { fmtDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Re-fetches the page data every 30 s while the tab is visible. */
export function LiveRefresh({ every = 30 }: { every?: number }) {
  const router = useRouter();
  const [ago, setAgo] = useState(0);
  const [pending, start] = useTransition();
  const last = useRef(0);
  const refresh = useCallback(() => {
    last.current = Date.now();
    start(() => router.refresh());
    setAgo(0);
  }, [router]);
  useEffect(() => {
    last.current = Date.now();
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - last.current) / 1000);
      if (s >= every && document.visibilityState === "visible") refresh();
      else setAgo(s);
    }, 1000);
    return () => clearInterval(tick);
  }, [every, refresh]);
  return (
    <button
      type="button"
      onClick={refresh}
      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-primary/40"
      title="Refresh now"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-good" />
      </span>
      Live · {pending ? "updating…" : ago < 2 ? "just now" : `${ago}s ago`}
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
    </button>
  );
}

const TONE: [RegExp, string][] = [
  [/publish/i, "bg-primary"],
  [/approve|appl/i, "bg-good"],
  [/reject|discard/i, "bg-critical"],
  [/ai|analys|brief/i, "bg-info"],
];

/** Activity log with new entries sliding in. */
export function ActivityFeed({ items }: { items: AuditEntry[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <AnimatedList delay={120} className="max-h-80 gap-2 overflow-auto">
      {items.slice(0, 12).map((a, i) => (
        <div key={a.at + i} className="flex w-full items-start gap-3 rounded-xl border bg-white px-3 py-2.5">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE.find(([re]) => re.test(a.action))?.[1] ?? "bg-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{a.action}</div>
            {a.detail && <div className="truncate text-xs text-muted-foreground">{a.detail}</div>}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDateTime(a.at).replace(" UTC", "")}</span>
        </div>
      ))}
    </AnimatedList>
  );
}
