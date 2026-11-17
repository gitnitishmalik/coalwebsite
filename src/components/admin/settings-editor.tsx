"use client";

import { useMemo, useRef } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runChecks } from "@/lib/checks";
import type { Board } from "@/lib/types";
import { DraftBar } from "./draft-bar";
import { Panel } from "./page-title";
import { useDraft } from "./use-draft";

export function SettingsEditor({ initial, isDraft, status }: { initial: Board; isDraft: boolean; status: { label: string; ok: boolean; detail: string; env: string }[] }) {
  const d = useDraft(initial, isDraft);
  const { board, update, setBoard } = d;
  const checks = useMemo(() => runChecks(board), [board]);
  const file = useRef<HTMLInputElement>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `jce-board-${board.meta.assessmentDate}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Board;
      if (!data?.meta || !Array.isArray(data.regions) || !Array.isArray(data.hba)) throw new Error("Not a JCE board file.");
      update(() => data);
      toast.success("Backup loaded into the editor. Save the draft to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  return (
    <>
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-2">
        <Panel title="Site">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann">Announcement banner</Label>
              <Input id="ann" defaultValue={board.settings.announcement ?? ""} placeholder="Leave empty to hide" onBlur={(e) => update((b) => ((b.settings.announcement = e.target.value.trim() || null), b))} />
              <p className="text-xs text-muted-foreground">Shown in a strip above the header on every public page.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em">Contact email</Label>
              <Input id="em" type="email" defaultValue={board.settings.contactEmail} onBlur={(e) => e.target.value && update((b) => ((b.settings.contactEmail = e.target.value.trim()), b))} />
            </div>
          </div>
        </Panel>

        <Panel title="Backup" sub="Download everything as JSON, or load a backup into the editor.">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJson}><Download /> Download JSON</Button>
            <Button variant="outline" onClick={() => file.current?.click()}><Upload /> Load backup</Button>
            <input ref={file} type="file" accept="application/json" className="sr-only" onChange={(e) => importJson(e.target.files?.[0])} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Public JSON API: <a className="underline" href="/api/board" target="_blank">/api/board</a></p>
        </Panel>

        <Panel title="Connections" sub="Set these in Vercel → Project → Settings → Environment Variables, then redeploy." className="xl:col-span-2">
          <ul className="divide-y">
            {status.map((s) => (
              <li key={s.label} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className={`size-2 rounded-full ${s.ok ? "bg-good" : "bg-warning"}`} />
                <span className="w-40 font-medium">{s.label}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{s.env}</code>
                <span className={`ml-auto text-xs ${s.ok ? "text-muted-foreground" : "text-warning"}`}>{s.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <DraftBar dirty={d.dirty} hasDraft={d.hasDraft} pending={d.pending} checks={checks} onSave={d.save} onPublish={d.publish} onDiscard={d.discard} />
    </>
  );
}
