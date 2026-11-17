"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { testAiAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

type Row = { role: string; model: string; ok: boolean; ms: number; detail: string };

const ROLE: Record<string, string> = { reasoning: "Analysis & brief", vision: "Reading files", fast: "Quick tasks" };

export function AiTest({ models, enabled }: { models: Record<string, string>; enabled: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await testAiAction();
      if (!res.ok) return void toast.error(res.error);
      setRows(res.data!);
    });
  return (
    <div>
      <ul className="divide-y">
        {Object.entries(models).map(([role, model]) => {
          const r = rows?.find((x) => x.role === role);
          return (
            <li key={role} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              {r ? r.ok ? <CircleCheck className="size-4 text-good" /> : <CircleX className="size-4 text-critical" /> : <span className="size-4 rounded-full border" />}
              <span className="w-36 font-medium">{ROLE[role] ?? role}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{model}</code>
              <span className="ml-auto text-xs text-muted-foreground">{r ? (r.ok ? `OK · ${(r.ms / 1000).toFixed(1)}s` : r.detail) : ""}</span>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="mt-3" onClick={run} disabled={busy || !enabled}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Zap />} Test AI connection
      </Button>
      {!enabled && <p className="mt-2 text-xs text-warning">Add NVIDIA_API_KEY to the environment first.</p>}
    </div>
  );
}
