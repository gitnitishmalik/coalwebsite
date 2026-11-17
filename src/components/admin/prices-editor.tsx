"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChecksList } from "@/components/site/insight-cards";
import { RangeBar } from "@/components/site/range-bar";
import { runChecks } from "@/lib/checks";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DraftBar } from "./draft-bar";
import { ImageImport } from "./image-import";
import { NumCell, TextCell } from "./num-cell";
import { Panel } from "./page-title";
import { useDraft } from "./use-draft";

export function PricesEditor({ initial, isDraft, aiOn }: { initial: Board; isDraft: boolean; aiOn: boolean }) {
  const d = useDraft(initial, isDraft);
  const { board, update } = d;
  const checks = useMemo(() => runChecks(board), [board]);

  return (
    <>
      <div className="grid gap-6 p-4 md:p-8 2xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Import from image" sub="Claude reads the board and fills the tables below. You review every change before it is applied.">
            <ImageImport board={board} aiOn={aiOn} onApply={(b) => update(() => b)} />
          </Panel>

          <Panel title="Schedule">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ad">Assessment date</Label>
                <Input id="ad" type="date" value={board.meta.assessmentDate} onChange={(e) => e.target.value && update((b) => ((b.meta.assessmentDate = e.target.value), b))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu">Next update</Label>
                <Input id="nu" type="date" value={board.meta.nextUpdate} onChange={(e) => e.target.value && update((b) => ((b.meta.nextUpdate = e.target.value), b))} />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    update((b) => {
                      const t = new Date(b.meta.assessmentDate + "T00:00:00Z");
                      t.setUTCDate(t.getUTCDate() + 7);
                      b.meta.nextUpdate = t.toISOString().slice(0, 10);
                      return b;
                    })
                  }
                >
                  Next update = assessment + 7 days
                </Button>
              </div>
            </div>
          </Panel>

          {board.regions.map((region, ri) => (
            <Panel
              key={region.id + ri}
              title={undefined}
              action={undefined}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <TextCell value={region.label} aria-label="Region name" className="h-9 max-w-56 text-base font-bold" onCommit={(v) => update((b) => ((b.regions[ri].label = v.trim() || b.regions[ri].label), b))} />
                <select
                  aria-label="Basis"
                  value={region.basis}
                  onChange={(e) => update((b) => ((b.regions[ri].basis = e.target.value as "GAR" | "NAR"), b))}
                  className="h-8 rounded-md border bg-white px-2 text-sm"
                >
                  <option>GAR</option>
                  <option>NAR</option>
                </select>
                <span className="text-xs text-muted-foreground">{region.rows.length} rows</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-critical"
                  onClick={() => confirm(`Remove the ${region.label} region and its ${region.rows.length} rows?`) && update((b) => (b.regions.splice(ri, 1), b))}
                >
                  <Trash2 /> Remove region
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Ref</th>
                      <th className="px-2 py-2 font-medium">Origin</th>
                      <th className="px-2 py-2 text-right font-medium">Spec</th>
                      <th className="px-2 py-2 text-right font-medium">Mid</th>
                      <th className="px-2 py-2 text-right font-medium">Low</th>
                      <th className="px-2 py-2 text-right font-medium">High</th>
                      <th className="hidden px-2 py-2 font-medium md:table-cell">Range</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {region.rows.map((row, i) => (
                      <tr key={i} className={cn("border-b last:border-0", row.low > row.high && "bg-red-50", row.note && "bg-amber-50")}>
                        <td className="px-1 py-1"><TextCell value={row.ref} aria-label="Reference" className="w-24 font-mono text-xs font-semibold" onCommit={(v) => update((b) => ((b.regions[ri].rows[i].ref = v.trim()), b))} /></td>
                        <td className="px-1 py-1"><TextCell value={row.origin} aria-label="Origin" onCommit={(v) => update((b) => ((b.regions[ri].rows[i].origin = v.trim()), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={row.spec} step="1" aria-label="Spec" className="w-20" onCommit={(v) => v != null && update((b) => ((b.regions[ri].rows[i].spec = Math.round(v)), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={row.mid} aria-label="Mid" className="font-semibold" onCommit={(v) => v != null && update((b) => ((b.regions[ri].rows[i].mid = v), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={row.low} aria-label="Low" onCommit={(v) => v != null && update((b) => ((b.regions[ri].rows[i].low = v), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={row.high} aria-label="High" onCommit={(v) => v != null && update((b) => ((b.regions[ri].rows[i].high = v), b))} /></td>
                        <td className="hidden px-2 py-1 md:table-cell"><RangeBar mid={row.mid} low={row.low} high={row.high} className="w-28" /></td>
                        <td className="px-1 py-1">
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.ref}`} onClick={() => update((b) => (b.regions[ri].rows.splice(i, 1), b))}>
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {region.rows.some((r) => r.note) && <p className="mt-2 text-xs text-warning">Rows highlighted in amber were unreadable in the image — please check them.</p>}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  update((b) => {
                    const last = b.regions[ri].rows.at(-1);
                    b.regions[ri].rows.push({ ref: "SCR#", origin: last?.origin ?? "", spec: last?.spec ?? 6000, mid: last?.mid ?? 100, low: last?.low ?? 99, high: last?.high ?? 101 });
                    return b;
                  })
                }
              >
                <Plus /> Add row
              </Button>
            </Panel>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              update((b) => {
                b.regions.push({ id: `region-${Date.now()}`, label: "New region", basis: "NAR", rows: [] });
                return b;
              })
            }
          >
            <Plus /> Add region
          </Button>

          <Panel title="Indonesian GAR ladder" sub="Rows with a ref (e.g. SCR#1) are drawn as anchors. Tick “reconstructed” for values that were unreadable in the source.">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">Edit {board.ladder.length} ladder grades</summary>
              <div className="mt-3 max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-right font-medium">GAR</th>
                      <th className="px-2 py-2 font-medium">Ref</th>
                      <th className="px-2 py-2 text-right font-medium">Mid</th>
                      <th className="px-2 py-2 text-right font-medium">Low</th>
                      <th className="px-2 py-2 text-right font-medium">High</th>
                      <th className="px-2 py-2 font-medium">Reconstructed</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {board.ladder.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-1 py-1 text-right"><NumCell value={p.spec} step="1" aria-label="GAR" className="w-20" onCommit={(v) => v != null && update((b) => ((b.ladder[i].spec = Math.round(v)), b))} /></td>
                        <td className="px-1 py-1"><TextCell value={p.ref ?? ""} placeholder="—" aria-label="Ref" className="w-24 font-mono text-xs" onCommit={(v) => update((b) => ((b.ladder[i].ref = v.trim() || null), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={p.mid} aria-label="Mid" className="font-semibold" onCommit={(v) => v != null && update((b) => ((b.ladder[i].mid = v), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={p.low} aria-label="Low" onCommit={(v) => v != null && update((b) => ((b.ladder[i].low = v), b))} /></td>
                        <td className="px-1 py-1 text-right"><NumCell value={p.high} aria-label="High" onCommit={(v) => v != null && update((b) => ((b.ladder[i].high = v), b))} /></td>
                        <td className="px-2 py-1"><input type="checkbox" aria-label="Reconstructed" checked={!!p.reconstructed} onChange={(e) => update((b) => ((b.ladder[i].reconstructed = e.target.checked), b))} className="size-4 accent-primary" /></td>
                        <td className="px-1 py-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Delete grade" onClick={() => update((b) => (b.ladder.splice(i, 1), b))}>
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
                onClick={() => update((b) => (b.ladder.push({ spec: 3300, mid: 35, low: 34.65, high: 35.35, ref: null }), b.ladder.sort((x, y) => y.spec - x.spec), b))}
              >
                <Plus /> Add grade
              </Button>
            </details>
          </Panel>
        </div>

        <aside className="2xl:sticky 2xl:top-6 2xl:self-start">
          <ChecksList checks={checks} className="p-5" />
        </aside>
      </div>
      <DraftBar dirty={d.dirty} hasDraft={d.hasDraft} pending={d.pending} checks={checks} onSave={d.save} onPublish={d.publish} onDiscard={d.discard} />
    </>
  );
}
