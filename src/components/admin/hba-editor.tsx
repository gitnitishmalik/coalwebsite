"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Check, ExternalLink, LinkIcon, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { approvePendingAction, rejectPendingAction, searchHbaAction } from "@/app/admin/actions";
import { HbaChart } from "@/components/charts/hba-chart";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { runChecks } from "@/lib/checks";
import { fmtDateTime, usd } from "@/lib/format";
import type { Board, HbaPoint, HbaStatus, PendingHba } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DraftBar } from "./draft-bar";
import { NumCell, TextCell } from "./num-cell";
import { Panel } from "./page-title";
import { useDraft } from "./use-draft";

const STATUSES: { v: HbaStatus; l: string }[] = [
  { v: "official", l: "Official (Ministry)" },
  { v: "corroborated", l: "Corroborated (2+)" },
  { v: "single", l: "Single source" },
  { v: "derived", l: "Derived" },
  { v: "missing", l: "Missing" },
];

function nextPeriod(last: HbaPoint | undefined): Pick<HbaPoint, "period" | "date"> {
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!last) return { period: "Jan-I", date: `${new Date().getUTCFullYear()}-01-01` };
  const d = new Date(last.date + "T00:00:00Z");
  if (last.period.endsWith("-I")) return { period: last.period.replace(/-I$/, "-II"), date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-15` };
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { period: `${M[n.getUTCMonth()]}-I`, date: n.toISOString().slice(0, 10) };
}

export function HbaEditor({ initial, isDraft, pending, aiOn }: { initial: Board; isDraft: boolean; pending: PendingHba[]; aiOn: boolean }) {
  const router = useRouter();
  const d = useDraft(initial, isDraft);
  const { board, update } = d;
  const checks = useMemo(() => runChecks(board), [board]);
  const [busy, start] = useTransition();
  const [sourcesFor, setSourcesFor] = useState<number | null>(null);
  const sorted = useMemo(() => board.hba.map((p, i) => ({ p, i })).sort((a, b) => b.p.date.localeCompare(a.p.date)), [board.hba]);

  const search = () =>
    start(async () => {
      const res = await searchHbaAction();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Done");
      router.refresh();
    });
  const approve = (id: string) =>
    start(async () => {
      if (d.dirty) return void toast.error("Save your draft first, then approve.");
      const res = await approvePendingAction(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Approved");
      router.refresh();
    });
  const reject = (id: string) =>
    start(async () => {
      const res = await rejectPendingAction(id);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  const editing = sourcesFor != null ? board.hba[sourcesFor] : null;

  return (
    <>
      <div className="space-y-6 p-4 md:p-8">
        <Panel
          title="Waiting for approval"
          sub="Values Claude found on the web (button below, or the daily search). Approving adds them to your draft — publish to make them live."
          action={
            <Button onClick={search} disabled={busy || !aiOn}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Bot />} Search for new HBA releases
            </Button>
          }
        >
          {!aiOn && <p className="mb-3 text-sm text-warning">AI is off — add ANTHROPIC_API_KEY to enable web search.</p>}
          {busy && <p className="mb-3 text-sm text-muted-foreground">Claude is searching the Ministry and news sites. This can take a minute…</p>}
          <AnimatePresence initial={false}>
            {pending.length ? (
              <ul className="space-y-3">
                {pending.map((p) => (
                  <motion.li key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-bold">{p.period} {p.date.slice(0, 4)}</span>
                      <span className="tnum text-xl font-bold">{p.value != null ? usd(p.value) : "—"}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", p.status === "single" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800")}>
                        {STATUSES.find((s) => s.v === p.status)?.l}
                      </span>
                      {p.note && <span className="text-xs font-medium text-warning">{p.note}</span>}
                      <span className="text-xs text-muted-foreground">found {fmtDateTime(p.foundAt)} · {p.foundBy === "cron" ? "daily search" : "manual search"}</span>
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => reject(p.id)} disabled={busy}><X /> Reject</Button>
                        <Button size="sm" onClick={() => approve(p.id)} disabled={busy}><Check /> Approve</Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {p.sources.map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-ink-soft underline decoration-border underline-offset-4 hover:text-primary">
                          {s.name} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing waiting. New releases appear here automatically once the daily search runs.</p>
            )}
          </AnimatePresence>
        </Panel>

        <Panel title="Preview">
          <HbaChart hba={board.hba} height={300} />
        </Panel>

        <Panel title="HBA ledger" sub="6,322 GAR, USD/t. Leave the value empty for a period you have not verified yet.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Period</th>
                  <th className="px-2 py-2 font-medium">From</th>
                  <th className="px-2 py-2 text-right font-medium">HBA</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Sources</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ p, i }) => (
                  <tr key={i} className={cn("border-b last:border-0", p.value == null && "bg-muted/40")}>
                    <td className="px-1 py-1"><TextCell value={p.period} aria-label="Period" className="w-24 font-mono text-xs font-semibold" onCommit={(v) => update((b) => ((b.hba[i].period = v.trim()), b))} /></td>
                    <td className="px-1 py-1">
                      <input type="date" aria-label="Applies from" value={p.date} onChange={(e) => e.target.value && update((b) => ((b.hba[i].date = e.target.value), b))} className="h-8 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-ring focus:outline-none" />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <NumCell
                        nullable
                        value={p.value}
                        aria-label="HBA value"
                        className="font-semibold"
                        onCommit={(v) => update((b) => ((b.hba[i].value = v), v == null ? (b.hba[i].status = "missing") : b.hba[i].status === "missing" && (b.hba[i].status = "single"), b))}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select aria-label="Status" value={p.status} onChange={(e) => update((b) => ((b.hba[i].status = e.target.value as HbaStatus), b))} className="h-8 rounded-md border bg-white px-2 text-sm">
                        {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <Button variant="ghost" size="sm" onClick={() => setSourcesFor(i)}>
                        <LinkIcon /> {p.sources.length} source{p.sources.length === 1 ? "" : "s"}
                      </Button>
                    </td>
                    <td className="px-1 py-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.period}`} onClick={() => update((b) => (b.hba.splice(i, 1), b))}>
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              update((b) => {
                const last = [...b.hba].sort((x, y) => x.date.localeCompare(y.date)).at(-1);
                b.hba.push({ ...nextPeriod(last), value: null, status: "missing", sources: [] });
                return b;
              })
            }
          >
            <Plus /> Add next period
          </Button>
        </Panel>
      </div>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setSourcesFor(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sources for {editing?.period}</DialogTitle>
            <DialogDescription>Link every page that states this value. Two independent outlets — or the Ministry — make it “confirmed”.</DialogDescription>
          </DialogHeader>
          {editing && sourcesFor != null && (
            <div className="space-y-2">
              {editing.sources.map((s, si) => (
                <div key={si} className="flex gap-2">
                  <Input defaultValue={s.name} placeholder="Name" className="w-40" onBlur={(e) => update((b) => ((b.hba[sourcesFor].sources[si].name = e.target.value), b))} />
                  <Input defaultValue={s.url} placeholder="https://…" className="flex-1" onBlur={(e) => update((b) => ((b.hba[sourcesFor].sources[si].url = e.target.value.trim()), b))} />
                  <Button variant="ghost" size="icon" aria-label="Remove source" onClick={() => update((b) => (b.hba[sourcesFor].sources.splice(si, 1), b))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => update((b) => (b.hba[sourcesFor].sources.push({ name: "", url: "" }), b))}>
                <Plus /> Add source
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSourcesFor(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DraftBar dirty={d.dirty} hasDraft={d.hasDraft} pending={d.pending} checks={checks} onSave={d.save} onPublish={d.publish} onDiscard={d.discard} />
    </>
  );
}
