"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileImage, LoaderCircle, ScanText, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { extractImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Extracted } from "@/lib/ai";
import type { Board, Region } from "@/lib/types";
import { usd, num } from "@/lib/format";
import { cn } from "@/lib/utils";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "region";

/** Merge what Claude read into the draft. Unreadable values are kept but flagged. */
export function applyExtraction(board: Board, x: Extracted, imageUrl: string | null): Board {
  const regions: Region[] = x.regions.length
    ? x.regions.map((er) => {
        const existing = board.regions.find((r) => r.label.toLowerCase() === er.label.toLowerCase());
        return {
          id: existing?.id ?? slug(er.label),
          label: existing?.label ?? er.label,
          basis: er.basis,
          rows: er.rows.map((r) => ({ ref: r.ref.replace(/\s+/g, ""), origin: r.origin, spec: Math.round(r.spec), mid: r.mid, low: r.low, high: r.high, note: r.unreadable ? "Unreadable in source — check" : null })),
        };
      })
    : board.regions;
  const ladder = x.ladder.length
    ? x.ladder.map((p) => ({ spec: Math.round(p.spec), mid: p.mid, low: p.low, high: p.high, ref: p.ref ? p.ref.replace(/\s+/g, "") : null, reconstructed: p.unreadable }))
    : board.ladder;
  const date = x.assessmentDate && /^\d{4}-\d{2}-\d{2}$/.test(x.assessmentDate) ? x.assessmentDate : board.meta.assessmentDate;
  return { ...board, regions, ladder, meta: { ...board.meta, assessmentDate: date }, settings: { ...board.settings, boardImageUrl: imageUrl ?? board.settings.boardImageUrl } };
}

export function ImageImport({ board, aiOn, onApply }: { board: Board; aiOn: boolean; onApply: (b: Board) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ extracted: Extracted; imageUrl: string | null } | null>(null);
  const [pending, start] = useTransition();
  const [hover, setHover] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return void toast.error("Use a JPEG, PNG or WebP image.");
    if (f.size > 10 * 1024 * 1024) return void toast.error("Image is larger than 10 MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function read() {
    if (!file) return;
    const fd = new FormData();
    fd.set("image", file);
    start(async () => {
      const res = await extractImageAction(fd);
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data!);
    });
  }

  const current = new Map(board.regions.flatMap((r) => r.rows).map((r) => [r.ref, r]));

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
      <label
        onDragOver={(e) => (e.preventDefault(), setHover(true))}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => (e.preventDefault(), setHover(false), pick(e.dataTransfer.files[0]))}
        className={cn(
          "relative flex min-h-36 cursor-pointer items-center gap-4 overflow-hidden rounded-xl border-2 border-dashed p-5 transition-colors",
          hover ? "border-primary bg-accent/60" : "border-border hover:border-primary/50 hover:bg-accent/30",
        )}
      >
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected board" className="h-28 w-20 shrink-0 rounded-md border object-cover object-top" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Upload className="size-6" /></span>
        )}
        <span>
          <span className="block font-semibold">{file ? file.name : "Drop the weekly price-board image here"}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {file ? `${(file.size / 1048576).toFixed(2)} MB · click to choose another` : "JPEG, PNG or WebP up to 10 MB — or click to browse"}
          </span>
          {!aiOn && <span className="mt-2 block text-xs font-medium text-warning">AI is off: add ANTHROPIC_API_KEY to read images automatically.</span>}
        </span>
      </label>
      <Button size="lg" className="h-auto min-h-12 self-stretch px-6" onClick={read} disabled={!file || pending || !aiOn}>
        {pending ? <LoaderCircle className="animate-spin" /> : <ScanText />}
        {pending ? "Claude is reading…" : "Read with Claude"}
      </Button>

      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:col-span-2">
            <div className="flex items-center gap-3 rounded-xl bg-accent/60 p-3 text-sm text-accent-foreground">
              <Sparkles className="size-4 animate-pulse" /> Transcribing every row, range and reference. This usually takes 20–60 seconds.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileImage className="size-5 text-primary" /> Review what Claude read</DialogTitle>
            <DialogDescription>Changed values are highlighted. Nothing is saved until you apply it and save the draft.</DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-5">
              {result.extracted.notes.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">
                  {result.extracted.notes.map((n, i) => (
                    <li key={i} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />{n}</li>
                  ))}
                </ul>
              )}
              {result.extracted.regions.map((r) => (
                <div key={r.label}>
                  <h4 className="mb-2 text-sm font-semibold">{r.label} · {r.basis}</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-3 py-2">Ref</th><th className="px-3 py-2">Origin</th><th className="px-3 py-2 text-right">Spec</th><th className="px-3 py-2 text-right">Mid</th><th className="px-3 py-2 text-right">Low</th><th className="px-3 py-2 text-right">High</th></tr></thead>
                      <tbody>
                        {r.rows.map((row) => {
                          const old = current.get(row.ref.replace(/\s+/g, ""));
                          const cell = (v: number, o: number | undefined) => (
                            <td className={cn("tnum px-3 py-1.5 text-right", o != null && Math.abs(o - v) > 0.004 && "bg-amber-100 font-semibold")} title={o != null ? `was ${usd(o)}` : "new"}>{usd(v)}</td>
                          );
                          return (
                            <tr key={row.ref} className={cn("border-t", row.unreadable && "bg-red-50")}>
                              <td className="px-3 py-1.5 font-mono text-xs font-semibold">{row.ref}{row.unreadable && " ⚠"}</td>
                              <td className="px-3 py-1.5">{row.origin}</td>
                              <td className="tnum px-3 py-1.5 text-right">{num(row.spec)}</td>
                              {cell(row.mid, old?.mid)}
                              {cell(row.low, old?.low)}
                              {cell(row.high, old?.high)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {result.extracted.ladder.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Ladder: {result.extracted.ladder.length} grades read
                  {result.extracted.ladder.some((p) => p.unreadable) && `, ${result.extracted.ladder.filter((p) => p.unreadable).length} marked unreadable`}.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResult(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!result) return;
                onApply(applyExtraction(board, result.extracted, result.imageUrl));
                setResult(null);
                toast.success("Applied to the draft — review, then save or publish.");
              }}
            >
              Apply to draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
