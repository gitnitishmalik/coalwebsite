"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { aiEnabled, analyse, draftBrief, readImages, readText, testModels, type Extraction } from "@/lib/ai";
import { hbaStats } from "@/lib/analytics";
import { endSession, requireAdmin } from "@/lib/auth";
import { diffRows, mergeExtraction } from "@/lib/board-diff";
import { runChecks } from "@/lib/checks";
import { readFile, type FileContent } from "@/lib/extract-file";
import { runHbaSearch } from "@/lib/hba-search";
import { BoardSchema, HbaSchema } from "@/lib/schema";
import {
  audit,
  discardDraft,
  getDraft,
  getPending,
  getPublished,
  getUploads,
  publishDraft,
  ReadOnlyStoreError,
  saveDraft,
  savePending,
  saveUpload,
  storeFile,
  storeMode,
} from "@/lib/store";
import type { Board, HbaPoint, Region, UploadAnalysis } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof ReadOnlyStoreError) return { ok: false, error: err.message };
  if (err instanceof z.ZodError) return { ok: false, error: "Some fields are invalid: " + err.issues.slice(0, 3).map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
  console.error("[admin action]", err);
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

const refreshAdmin = () => revalidatePath("/admin", "layout");

/** Drop empty rows the editor may leave behind, then validate. */
function parseBoard(input: Board): Board {
  const b = structuredClone(input);
  b.hba = b.hba.map((p) => ({ ...p, sources: p.sources.filter((s) => s.url?.trim()).map((s) => ({ name: s.name.trim() || new URL(s.url).hostname, url: s.url.trim() })) }));
  b.brief.paragraphs = b.brief.paragraphs.map((t) => t.trim()).filter(Boolean);
  b.settings.announcement = b.settings.announcement?.trim() || null;
  return BoardSchema.parse(b) as Board;
}

/* ---------------- draft / publish ---------------- */

export async function saveDraftAction(input: Board): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    await saveDraft(parseBoard(input));
    await audit("Saved draft", me.user);
    refreshAdmin();
    return { ok: true, message: "Draft saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function publishAction(input?: Board): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    if (input) await saveDraft(parseBoard(input));
    const pub = await publishDraft(me.user);
    revalidatePath("/", "layout");
    return { ok: true, message: `Published version ${pub.meta.version}. The public site is updating now.` };
  } catch (e) {
    return fail(e);
  }
}

export async function discardDraftAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    await discardDraft();
    await audit("Discarded draft", me.user);
    refreshAdmin();
    return { ok: true, message: "Draft discarded — back to the published version." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- upload → AI analysis ---------------- */

function combine(parts: { from: string; x: Extraction }[]): Extraction | null {
  const regions: Region[] = [];
  let ladder: Extraction["ladder"] = [];
  let assessmentDate: string | null = null;
  const notes: string[] = [], uncertain: string[] = [];
  for (const { from, x } of parts) {
    for (const r of x.regions) {
      const existing = regions.find((e) => e.label.toLowerCase() === r.label.toLowerCase());
      if (!existing) regions.push(r);
      else for (const row of r.rows) if (!existing.rows.some((o) => o.ref === row.ref)) existing.rows.push(row);
    }
    if (!ladder.length && x.ladder.length) ladder = x.ladder;
    assessmentDate ??= x.assessmentDate;
    notes.push(...x.notes.map((n) => (parts.length > 1 ? `${from}: ${n}` : n)));
    uncertain.push(...x.uncertain.map((u) => (parts.length > 1 ? `${from}: ${u}` : u)));
  }
  if (!regions.length && !ladder.length) return notes.length ? { assessmentDate, regions: [], ladder: [], notes, uncertain } : null;
  return { assessmentDate, regions, ladder, notes, uncertain };
}

export async function analyzeUploadAction(form: FormData): Promise<ActionResult<UploadAnalysis>> {
  const me = await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "AI is off. Add NVIDIA_API_KEY in the environment to analyse uploads." };
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const pasted = String(form.get("text") ?? "").trim().slice(0, 60_000);
    if (!files.length && !pasted) return { ok: false, error: "Add a file or paste some data first." };
    if (files.length > 5) return { ok: false, error: "Upload up to 5 files at a time." };
    if (files.some((f) => f.size > 10 * 1024 * 1024)) return { ok: false, error: "Each file must be under 10 MB." };

    // 1. Read every file (images → slices, sheets/PDF/CSV → text)
    const t0 = Date.now();
    const contents: FileContent[] = await Promise.all(files.map(readFile));
    const tRead = Date.now();
    if (pasted) contents.push({ name: "Pasted data", kind: "text", size: pasted.length, meta: `${pasted.split(/\r?\n/).length} lines`, text: pasted });
    const urls = await Promise.all(files.map((f) => storeFile(f).catch(() => null)));

    // 2. Extract prices — each image on its own, all text together
    const parts: { from: string; x: Extraction }[] = [];
    const reads: Promise<void>[] = [];
    let model = "";
    for (const c of contents.filter((c) => c.images?.length))
      reads.push(
        readImages(c.images!).then((r) => {
          parts.push({ from: c.name, x: r });
          model = r.model;
        }),
      );
    const textBlob = contents
      .filter((c) => c.text)
      .map((c) => `### ${c.name}\n${c.text}`)
      .join("\n\n");
    if (textBlob.trim())
      reads.push(
        readText(textBlob).then((r) => {
          parts.push({ from: "documents", x: r });
          model ||= r.model;
        }),
      );
    const settled = await Promise.allSettled(reads);
    const tExtract = Date.now();
    const readErrors = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected").map((s) => (s.reason instanceof Error ? s.reason.message : "A file could not be read."));
    const extraction = combine(parts);
    if (!extraction && readErrors.length) throw new Error(readErrors[0]);

    // 3. Facts computed in code — the AI only narrates these
    const [live, { board: draft }] = await Promise.all([getPublished(), getDraft()]);
    const hasRows = !!extraction && (extraction.regions.length > 0 || extraction.ladder.length > 0);
    const changes = hasRows ? diffRows(live, extraction!.regions) : [];
    const proposed = hasRows ? mergeExtraction(draft, extraction!) : null;
    const checks = proposed ? runChecks(proposed).filter((c) => c.level !== "pass") : [];
    const moved = changes.filter((c) => c.delta != null && c.delta !== 0);
    const stats = hbaStats(live.hba);
    const sameHba = proposed ? live.hba.find((p) => p.date === proposed.meta.assessmentDate && p.value != null) : null;
    const scr1 = extraction?.regions.flatMap((r) => r.rows).find((r) => r.ref === "SCR#1");
    const facts = {
      uploadedFiles: contents.map((c) => ({ name: c.name, type: c.kind, details: c.meta })),
      extractedAssessmentDate: extraction?.assessmentDate ?? null,
      extractedBoard: extraction?.regions.map((r) => ({ region: r.label, basis: r.basis, rows: r.rows.map(({ ref, origin, spec, mid, low, high }) => ({ ref, origin, spec, mid, low, high })) })) ?? [],
      ladder: extraction?.ladder.length ? { grades: extraction.ladder.length, top: extraction.ladder[0], bottom: extraction.ladder.at(-1) } : null,
      liveBoardAssessmentDate: live.meta.assessmentDate,
      changesVsLiveBoard: moved.map(({ ref, label, before, after, delta, pct }) => ({ ref, label, before, after, delta, pct })),
      unchangedReferences: changes.filter((c) => c.delta === 0).length,
      newReferences: changes.filter((c) => c.before == null).map((c) => c.ref),
      biggestRise: moved.filter((c) => (c.delta ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0] ?? null,
      biggestFall: moved.filter((c) => (c.delta ?? 0) < 0).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0] ?? null,
      scr1VsHbaSamePeriod: scr1 && sameHba?.value != null ? { hbaPeriod: sameHba.period, hba: sameHba.value, scr1: scr1.mid, gap: Number((scr1.mid - sameHba.value).toFixed(2)) } : null,
      latestHba: stats ? { period: stats.last.period, value: stats.last.value } : null,
      cellsToDoubleCheck: extraction?.uncertain.slice(0, 25) ?? [],
      readerNotes: [...(extraction?.notes ?? []), ...readErrors.map((e) => `A file could not be read: ${e}`)],
      checks: checks.slice(0, 12).map((c) => ({ level: c.level, title: c.title, detail: c.detail })),
      documentText: hasRows ? undefined : textBlob.slice(0, 12_000) || undefined,
    };

    let ai: UploadAnalysis["ai"] = null;
    let aiError: string | null = null;
    let grounding: UploadAnalysis["grounding"] = null;
    try {
      const a = await analyse(facts, form.get("deep") === "1");
      ai = { overview: a.overview, summary: a.summary, highlights: a.highlights, risks: a.risks, model: a.model, ms: a.ms };
      grounding = a.grounding;
    } catch (e) {
      aiError = e instanceof Error ? e.message : "The summary could not be written.";
    }

    const tDone = Date.now();
    const timings = { prepare: tRead - t0, extract: tExtract - tRead, summary: tDone - tExtract, total: tDone - t0 };
    console.info("[upload] timings ms", timings);
    const record: UploadAnalysis = {
      timings,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: me.user,
      files: contents.map((c, i) => ({ name: c.name, kind: c.kind, size: c.size, meta: c.meta, url: urls[i] ?? null })),
      extracted: hasRows ? { assessmentDate: extraction!.assessmentDate, regions: extraction!.regions, ladder: extraction!.ladder } : null,
      uncertain: extraction?.uncertain ?? [],
      notes: facts.readerNotes,
      changes,
      checks,
      ai: ai && { ...ai, model: ai.model || model },
      aiError,
      grounding,
      appliedAt: null,
    };
    if (storeMode() !== "readonly") {
      await saveUpload(record);
      await audit("AI analysed an upload", `${contents.map((c) => c.name).join(", ")} by ${me.user}`);
      refreshAdmin();
    }
    return { ok: true, data: record };
  } catch (e) {
    return fail(e);
  }
}

export async function applyUploadAction(id: string, what: { prices: boolean; brief: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    const uploads = await getUploads();
    const item = uploads.find((u) => u.id === id);
    if (!item) return { ok: false, error: "That analysis is no longer available." };
    let { board } = await getDraft();
    if (what.prices) {
      if (!item.extracted) return { ok: false, error: "No prices were found in this upload." };
      board = mergeExtraction(board, item.extracted, item.files.find((f) => f.kind === "image")?.url ?? null);
    }
    if (what.brief) {
      if (!item.ai) return { ok: false, error: "There is no AI summary to use." };
      board.brief = { paragraphs: item.ai.summary, generatedAt: item.at, model: item.ai.model, reviewedBy: null, reviewedAt: null };
    }
    await saveDraft(parseBoard(board));
    await saveUpload({ ...item, appliedAt: new Date().toISOString() });
    await audit(`Applied upload to draft (${[what.prices && "prices", what.brief && "summary"].filter(Boolean).join(" + ")})`, me.user);
    refreshAdmin();
    return { ok: true, message: "Added to the draft. Review it on the Prices page, then publish." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- AI: brief + connection test ---------------- */

export async function draftBriefAction(input: Board, deep = false): Promise<ActionResult<{ paragraphs: string[]; model: string; unverified: string[] }>> {
  const me = await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "AI is off. Add NVIDIA_API_KEY in the environment." };
    const r = await draftBrief(parseBoard(input), deep === true);
    await audit("AI drafted the market brief", me.user);
    return { ok: true, data: { paragraphs: r.paragraphs, model: r.model, unverified: r.grounding.unverified } };
  } catch (e) {
    return fail(e);
  }
}

export async function testAiAction(): Promise<ActionResult<Awaited<ReturnType<typeof testModels>>>> {
  await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "NVIDIA_API_KEY is not set." };
    return { ok: true, data: await testModels() };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- HBA: news search + approvals ---------------- */

export async function searchHbaAction(): Promise<ActionResult<{ added: number; note: string }>> {
  const me = await requireAdmin();
  try {
    const { added, note } = await runHbaSearch("ai-search");
    await audit("Searched the news for new HBA releases", `${added} new by ${me.user}`);
    refreshAdmin();
    return { ok: true, data: { added, note }, message: added ? `${added} HBA value${added > 1 ? "s" : ""} waiting for approval. ${note}` : `Nothing new. ${note}` };
  } catch (e) {
    return fail(e);
  }
}

export async function approvePendingAction(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    const pending = await getPending();
    const item = pending.find((p) => p.id === id);
    if (!item) return { ok: false, error: "That item is no longer pending." };
    const point = HbaSchema.parse({ period: item.period, date: item.date, value: item.value, status: item.status, sources: item.sources }) as HbaPoint;
    const { board } = await getDraft();
    const i = board.hba.findIndex((p) => p.date === point.date);
    if (i >= 0) {
      const prev = board.hba[i];
      const sameValue = prev.value != null && Math.abs(prev.value - (point.value ?? 0)) < 0.005;
      const sources = sameValue ? [...prev.sources, ...point.sources.filter((s) => !prev.sources.some((m) => m.url === s.url))] : point.sources;
      const status: HbaPoint["status"] =
        point.status === "official" || (sameValue && prev.status === "official") ? "official" : sources.length >= 2 ? "corroborated" : point.status;
      board.hba[i] = { ...point, sources, status };
    } else board.hba.push(point);
    board.hba.sort((a, b) => a.date.localeCompare(b.date));
    await saveDraft(board);
    await savePending(pending.filter((p) => p.id !== id));
    await audit(`Approved HBA ${point.period}`, `${point.value} by ${me.user}`);
    refreshAdmin();
    return { ok: true, message: `HBA ${point.period} added to the draft. Publish to make it live.` };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectPendingAction(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    const pending = await getPending();
    await savePending(pending.filter((p) => p.id !== id));
    await audit("Rejected a pending HBA value", me.user);
    refreshAdmin();
    return { ok: true, message: "Removed." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- session ---------------- */

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}
