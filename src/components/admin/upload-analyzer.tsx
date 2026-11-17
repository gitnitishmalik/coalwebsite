"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, Check, ClipboardPaste, FileImage, FileSpreadsheet, FileText, FileType2, History, LoaderCircle,
  Minus, ScanSearch, ShieldAlert, Sparkles, Table2, TriangleAlert, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeUploadAction, applyUploadAction } from "@/app/admin/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChecksList } from "@/components/site/insight-cards";
import { fmtDateTime, num, usd } from "@/lib/format";
import type { UploadAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "./page-title";

const ACCEPT = "image/jpeg,image/png,image/webp,.xlsx,.csv,.pdf,.txt";
const MAX_REQUEST = 4.2 * 1024 * 1024; // Vercel's request limit is 4.5 MB

const iconFor = (kind: string) => (kind === "image" ? FileImage : kind === "spreadsheet" ? FileSpreadsheet : kind === "pdf" ? FileType2 : FileText);
const kindOfName = (f: File) => (f.type.startsWith("image/") ? "image" : /\.xlsx$/i.test(f.name) ? "spreadsheet" : /\.pdf$/i.test(f.name) ? "pdf" : "text");

/** Shrink large photos in the browser so uploads stay under the hosting limit. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

const STEPS = ["Reading files", "Extracting prices — every image is read twice", "Comparing with the live board", "Running data checks", "Writing the overview and summary", "Tracing every figure back to the data"];

function Working() {
  const [s, setS] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setT((x) => x + 1), 1000);
    const b = setInterval(() => setS((x) => Math.min(x + 1, STEPS.length - 1)), 9000);
    return () => (clearInterval(a), clearInterval(b));
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" />
        </span>
        <div>
          <div className="font-semibold">AI is working on your upload</div>
          <div className="text-xs text-muted-foreground">{t}s elapsed · usually 20–40 seconds (Deep analysis: about a minute)</div>
        </div>
      </div>
      <ol className="mt-5 space-y-2.5">
        {STEPS.map((label, i) => (
          <li key={label} className={cn("flex items-center gap-3 text-sm transition-colors", i > s ? "text-muted-foreground/60" : "text-foreground")}>
            {i < s ? <Check className="size-4 text-good" /> : i === s ? <LoaderCircle className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border" />}
            {label}
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

function Result({ a, onApplied }: { a: UploadAnalysis; onApplied: () => void }) {
  const [busy, start] = useTransition();
  const rows = a.extracted?.regions.reduce((n, r) => n + r.rows.length, 0) ?? 0;
  const moved = a.changes.filter((c) => c.delta != null && c.delta !== 0);
  const apply = (prices: boolean, brief: boolean) =>
    start(async () => {
      const res = await applyUploadAction(a.id, { prices, brief });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Applied");
      onApplied();
    });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      {/* Overview */}
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest text-primary uppercase">
              <ScanSearch className="size-4" /> Overview
            </div>
            <p className="mt-2 text-lg leading-snug font-semibold text-pretty">{a.ai?.overview ?? "The files were read, but the AI summary could not be written."}</p>
          </div>
          {a.grounding && (
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", a.grounding.unverified.length ? "bg-amber-50 text-warning" : "bg-green-50 text-good")}>
              {a.grounding.unverified.length ? <ShieldAlert className="size-4" /> : <BadgeCheck className="size-4" />}
              {a.grounding.unverified.length ? `${a.grounding.unverified.length} figure${a.grounding.unverified.length > 1 ? "s" : ""} not traced` : `All ${a.grounding.checked} figures traced to the data`}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {a.files.map((f) => {
            const Icon = iconFor(f.kind);
            return (
              <span key={f.name} className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs">
                <Icon className="size-4 text-primary" />
                {f.url ? <a href={f.url} target="_blank" className="font-medium hover:underline">{f.name}</a> : <span className="font-medium">{f.name}</span>}
                <span className="text-muted-foreground">{f.meta}</span>
              </span>
            );
          })}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Prices found", rows],
            ["Ladder grades", a.extracted?.ladder.length ?? 0],
            ["Changed vs live", moved.length],
            ["To double-check", a.uncertain.length],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tnum mt-0.5 text-2xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {a.grounding && a.grounding.unverified.length > 0 && (
          <p className="mt-4 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">
            These figures in the AI text don’t appear in the data: <b>{a.grounding.unverified.join(", ")}</b>. Edit them before using the summary.
          </p>
        )}
        {a.aiError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-critical">AI summary failed: {a.aiError}</p>}
        <p className="mt-4 text-xs text-muted-foreground">
          {fmtDateTime(a.at)} · by {a.by}
          {a.ai && ` · ${a.ai.model.split("/").pop()}`}
          {a.timings && ` · read ${(a.timings.extract / 1000).toFixed(0)}s + summary ${(a.timings.summary / 1000).toFixed(0)}s = ${(a.timings.total / 1000).toFixed(0)}s`}
          {a.appliedAt && ` · applied to draft ${fmtDateTime(a.appliedAt)}`}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* Summary */}
        <Panel title="AI summary" sub="Written only from the extracted data and the computed comparison.">
          {a.ai ? (
            <div className="space-y-3">
              {a.ai.summary.map((p, i) => (
                <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {p}
                </motion.p>
              ))}
              {a.ai.highlights.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t pt-4 text-sm">
                  {a.ai.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-good" />{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No summary.</p>
          )}
        </Panel>

        {/* Risks + uncertain */}
        <Panel title="Check before publishing" sub="From the double read, the data checks and the reader’s notes.">
          {a.ai?.risks.length || a.uncertain.length || a.notes.length ? (
            <ul className="space-y-2 text-sm">
              {a.ai?.risks.map((r, i) => <li key={`r${i}`} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />{r}</li>)}
              {a.uncertain.slice(0, 12).map((u, i) => <li key={`u${i}`} className="flex gap-2 text-muted-foreground"><ScanSearch className="mt-0.5 size-4 shrink-0 text-info" />{u}</li>)}
              {a.notes.slice(0, 6).map((n, i) => <li key={`n${i}`} className="flex gap-2 text-muted-foreground"><FileText className="mt-0.5 size-4 shrink-0" />{n}</li>)}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-good"><BadgeCheck className="size-4" /> Both reads agreed and nothing was flagged.</p>
          )}
        </Panel>
      </div>

      {/* Changes */}
      {a.changes.length > 0 && (
        <Panel title="Changes vs the live board" sub={`${moved.length} changed · ${a.changes.filter((c) => c.delta === 0).length} unchanged · ${a.changes.filter((c) => c.before == null).length} new`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                  <th className="px-2 py-2 font-medium">Ref</th>
                  <th className="px-2 py-2 font-medium">Assessment</th>
                  <th className="px-2 py-2 text-right font-medium">Live</th>
                  <th className="px-2 py-2 text-right font-medium">Uploaded</th>
                  <th className="px-2 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {a.changes.map((c) => (
                  <tr key={c.ref} className="border-b last:border-0">
                    <td className="px-2 py-2 font-mono text-xs font-semibold text-primary">{c.ref}</td>
                    <td className="px-2 py-2 text-muted-foreground">{c.label}</td>
                    <td className="tnum px-2 py-2 text-right text-muted-foreground">{c.before != null ? usd(c.before) : "—"}</td>
                    <td className="tnum px-2 py-2 text-right font-semibold">{usd(c.after)}</td>
                    <td className={cn("tnum px-2 py-2 text-right font-semibold whitespace-nowrap", c.delta == null ? "text-info" : c.delta > 0 ? "text-up" : c.delta < 0 ? "text-down" : "text-muted-foreground")}>
                      {c.delta == null ? (
                        "new"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {c.delta > 0 ? <ArrowUpRight className="size-3.5" /> : c.delta < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
                          {c.delta > 0 ? "+" : ""}{c.delta.toFixed(2)} ({c.pct! > 0 ? "+" : ""}{c.pct?.toFixed(2)}%)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {a.checks.length > 0 && <ChecksList checks={a.checks} />}

      {/* Extracted data */}
      {a.extracted && (
        <Panel title="Extracted data">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-primary">Show {rows} rows{a.extracted.ladder.length ? ` and ${a.extracted.ladder.length} ladder grades` : ""}</summary>
            <div className="mt-3 space-y-4">
              {a.extracted.regions.map((r) => (
                <div key={r.label} className="overflow-x-auto rounded-lg border">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-semibold">{r.label} · {r.basis}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {r.rows.map((row) => (
                        <tr key={row.ref} className={cn("border-t", row.note && "bg-amber-50")}>
                          <td className="px-3 py-1.5 font-mono text-xs font-semibold">{row.ref}</td>
                          <td className="px-3 py-1.5">{row.origin}</td>
                          <td className="tnum px-3 py-1.5 text-right">{num(row.spec)}</td>
                          <td className="tnum px-3 py-1.5 text-right font-semibold">{usd(row.mid)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-muted-foreground">{usd(row.low)} – {usd(row.high)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </details>
        </Panel>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-white/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm text-muted-foreground">Nothing changes on the live site until you publish.</span>
          {a.extracted && <Button variant="outline" size="lg" disabled={busy} onClick={() => apply(true, false)}><Table2 /> Apply prices to draft</Button>}
          {a.ai && <Button variant="outline" size="lg" disabled={busy} onClick={() => apply(false, true)}><Sparkles /> Use summary as market brief</Button>}
          {a.extracted && a.ai && (
            <Button size="lg" disabled={busy} onClick={() => apply(true, true)}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Check />} Apply both
            </Button>
          )}
          <Link href="/admin/prices" className={buttonVariants({ variant: "ghost", size: "lg" })}>Open draft →</Link>
        </div>
      </div>
    </motion.div>
  );
}

export function UploadAnalyzer({ history, aiOn, latest }: { history: UploadAnalysis[]; aiOn: boolean; latest: UploadAnalysis | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [hover, setHover] = useState(false);
  const [result, setResult] = useState<UploadAnalysis | null>(latest);
  const [pending, start] = useTransition();
  const [deep, setDeep] = useState(false);

  async function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!/\.(jpe?g|png|webp|xlsx|csv|pdf|txt)$/i.test(f.name)) {
        toast.error(`${f.name}: use an image, .xlsx, .csv, .pdf or .txt`);
        continue;
      }
      next.push(await compress(f));
    }
    setFiles(next.slice(0, 5));
  }

  const total = files.reduce((n, f) => n + f.size, 0) + text.length;

  function analyse() {
    if (total > MAX_REQUEST) return void toast.error("Files are too large together (max ~4 MB per analysis). Upload fewer at a time.");
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (text.trim()) fd.set("text", text);
    if (deep) fd.set("deep", "1");
    setResult(null);
    start(async () => {
      const res = await analyzeUploadAction(fd);
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data!);
      setFiles([]);
      setText("");
      toast.success("Analysis ready.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 p-4 md:p-8 2xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Upload" sub="Price-board images, Excel sheets, CSV, PDF reports or text. The AI reads everything, compares it with the live board and writes an overview.">
          {!aiOn && <p className="mb-4 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">AI is off — add <code className="font-mono">NVIDIA_API_KEY</code> to the environment to analyse uploads.</p>}
          <label
            onDragOver={(e) => (e.preventDefault(), setHover(true))}
            onDragLeave={() => setHover(false)}
            onDrop={(e) => (e.preventDefault(), setHover(false), add(e.dataTransfer.files))}
            className={cn("flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors", hover ? "border-primary bg-accent/60" : "hover:border-primary/50 hover:bg-accent/30")}
          >
            <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
            <motion.span animate={hover ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }} className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Upload className="size-6" />
            </motion.span>
            <span className="font-semibold">Drop files here or click to browse</span>
            <span className="text-sm text-muted-foreground">JPEG · PNG · WebP · XLSX · CSV · PDF · TXT — up to 5 files</span>
          </label>

          <AnimatePresence>
            {files.length > 0 && (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2">
                {files.map((f, i) => {
                  const Icon = iconFor(kindOfName(f));
                  return (
                    <motion.li key={f.name + i} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                      <Icon className="size-4 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <X className="size-4" />
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>

          <div className="mt-4">
            {showPaste ? (
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paste a table, prices, or notes…" className="font-mono text-xs" />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowPaste(true)}><ClipboardPaste /> Or paste data</Button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-11 px-6" onClick={analyse} disabled={pending || !aiOn || (!files.length && !text.trim())}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {pending ? "Analysing…" : "Analyse with AI"}
            </Button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft" title="Turns on the model's reasoning mode: slower (about 20 s more) but more thorough on messy files.">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="size-4 accent-primary" />
              Deep analysis (slower)
            </label>
            <span className="text-xs text-muted-foreground">{total ? `${(total / 1048576).toFixed(2)} MB selected` : "Large photos are compressed in your browser before upload."}</span>
          </div>
        </Panel>

        <AnimatePresence mode="wait">{pending ? <Working key="w" /> : result ? <Result key={result.id} a={result} onApplied={() => router.refresh()} /> : null}</AnimatePresence>
      </div>

      <aside className="2xl:sticky 2xl:top-6 2xl:self-start">
        <Panel title="Recent analyses">
          {history.length ? (
            <ul className="-mx-2 space-y-1">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => setResult(h)}
                    className={cn("w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted", result?.id === h.id && "bg-accent")}
                  >
                    <div className="truncate text-sm font-medium">{h.files.map((f) => f.name).join(", ")}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <History className="size-3" /> {fmtDateTime(h.at)}
                      {h.appliedAt && <span className="text-good">· applied</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Your analyses will appear here.</p>
          )}
        </Panel>
      </aside>
    </div>
  );
}
