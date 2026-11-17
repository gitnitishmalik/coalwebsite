import "server-only";
import * as z from "zod";
import { answerKey, hasSavedAnswer, remember } from "./ai-cache";
import { allRows, hbaStats, ladderSlope, nar6000, sameDayHba } from "./analytics";
import { diffRows } from "./board-diff";
import { groundText, type Grounding } from "./grounding";
import { chat, chatJson, MODELS, nvidiaEnabled, type ContentPart } from "./nvidia";
import type { Board, LadderPoint, Region } from "./types";

/**
 * AI features on NVIDIA's hosted models.
 *  - readImages / readText: turn an uploaded board (image, sheet, PDF, text) into rows
 *  - analyse: overview + summary of an upload, written only from computed facts
 *  - draftBrief: weekly market brief from the board's own numbers
 * Hallucination guards: temperature 0, facts computed in code, images read twice
 * and compared, every number in AI text traced back to the data (grounding), and
 * saved answers so the same input always gives the same output (ai-cache.ts).
 */

export { MODELS };
export const aiEnabled = nvidiaEnabled;

/* ---------------- extraction (compact format) ---------------- */
// Rows come back as short arrays instead of labelled objects: about a third of the output
// tokens, which made a full board read ~24 s instead of ~3 min on NVIDIA (measured Nov 2026).

export interface Extraction {
  assessmentDate: string | null;
  regions: Region[];
  ladder: LadderPoint[];
  notes: string[];
  uncertain: string[];
}

const CompactSchema = z.object({
  date: z.string().nullable().optional().catch(null),
  board: z.array(z.array(z.unknown())).catch([]),
  ladder: z.array(z.array(z.unknown())).catch([]),
  notes: z.array(z.string()).catch([]),
});
type Compact = z.infer<typeof CompactSchema>;

const FORMAT = `Reply with ONLY this JSON:
{"date": "YYYY-MM-DD or null",
 "board": [["Region","GAR|NAR","Ref","Origin",spec,mid,low,high,unreadable]],
 "ladder": [[gar,mid,low,high,"Ref or null",unreadable]],
 "notes": ["anything an editor should know"]}`;

const RULES = [
  "Transcribe ONLY what is printed. Never invent, estimate or fill in rows.",
  "board = the headline tables (e.g. Indonesia GAR, South America NAR, Russia NAR, USA NAR): one row per SCR reference.",
  "low/high = the two <<RANGE>> values in the printed order (left first). Do not reorder them.",
  "ladder = every line of a long ladder table (rows labelled 'Ladder' and its SCR anchor rows, with gar = the calorific value). Ladder rows do NOT go in board.",
  "unreadable = true if a value is covered or unclear (give your best reading).",
  "If there is no coal price table, return empty arrays and explain in notes.",
].join("\n- ");

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(x) ? x : NaN;
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "region";

function normalise(x: Compact): Omit<Extraction, "uncertain"> {
  const regions: Region[] = [];
  for (const r of x.board) {
    const [region, basis, ref, origin, spec, mid, low, high, unreadable] = r;
    const row = { ref: String(ref ?? "").replace(/\s+/g, ""), origin: String(origin ?? "").trim(), spec: Math.round(n(spec)), mid: n(mid), low: n(low), high: n(high) };
    if (!row.ref || ![row.mid, row.low, row.high].every(Number.isFinite)) continue;
    const label = String(region ?? "Other").replace(/\s+/g, " ").trim();
    let reg = regions.find((g) => g.label.toLowerCase() === label.toLowerCase());
    if (!reg) regions.push((reg = { id: slugify(label), label, basis: /GAR/i.test(String(basis)) ? "GAR" : "NAR", rows: [] }));
    if (reg.rows.some((o) => o.ref === row.ref)) continue; // first table wins (headline before ladder anchors)
    reg.rows.push({ ...row, spec: Number.isFinite(row.spec) ? row.spec : 0, note: unreadable === true ? "Unreadable in source — check" : null });
  }
  const seen = new Set<number>();
  const ladder: LadderPoint[] = [];
  for (const l of x.ladder) {
    const [gar, mid, low, high, ref, unreadable] = l;
    const p = { spec: Math.round(n(gar)), mid: n(mid), a: n(low), b: n(high) };
    if (!(p.spec > 0) || seen.has(p.spec) || ![p.mid, p.a, p.b].every(Number.isFinite)) continue;
    seen.add(p.spec);
    // Ladder tables often print high before low — order them; the board keeps the printed order.
    ladder.push({ spec: p.spec, mid: p.mid, low: Math.min(p.a, p.b), high: Math.max(p.a, p.b), ref: ref ? String(ref).replace(/\s+/g, "") : null, reconstructed: unreadable === true });
  }
  ladder.sort((a, b) => b.spec - a.spec);
  const date = x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null;
  return { assessmentDate: date, regions, ladder, notes: x.notes };
}

/** Cells where two independent reads disagree, or that fail the midpoint test. */
function compareReads(a: Omit<Extraction, "uncertain">, b: Omit<Extraction, "uncertain"> | null): string[] {
  const out: string[] = [];
  const bRows = new Map((b?.regions ?? []).flatMap((r) => r.rows).map((r) => [r.ref, r]));
  for (const r of a.regions)
    for (const row of r.rows) {
      const o = bRows.get(row.ref);
      if (b && !o) out.push(`${row.ref}: only seen in one read`);
      for (const k of ["mid", "low", "high", "spec"] as const) if (o && Math.abs(o[k] - row[k]) > 0.005) out.push(`${row.ref} ${k}: read as ${row[k]} and ${o[k]}`);
      const avg = (row.low + row.high) / 2;
      if (Math.abs(avg - row.mid) > 0.03) out.push(`${row.ref}: mid ${row.mid} is not the middle of ${row.low}–${row.high}`);
    }
  const bLad = new Map((b?.ladder ?? []).map((p) => [p.spec, p]));
  for (const p of a.ladder) {
    const o = bLad.get(p.spec);
    if (o && Math.abs(o.mid - p.mid) > 0.005) out.push(`Ladder ${p.spec}: mid read as ${p.mid} and ${o.mid}`);
    if (Math.abs((p.low + p.high) / 2 - p.mid) > 0.03) out.push(`Ladder ${p.spec}: mid ${p.mid} is not the middle of ${p.low}–${p.high}`);
  }
  return out;
}

const CLERK = "You are a meticulous data-entry clerk for a coal price-reporting agency. Accuracy over completeness.";

/* ---------------- 1a. images ---------------- */

export async function readImages(images: string[]): Promise<Extraction & { model: string }> {
  return (await remember(answerKey("read-images", images), () => readImagesNow(images))).value;
}

async function readImagesNow(images: string[]): Promise<Extraction & { model: string }> {
  const content: ContentPart[] = [
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text",
      text: `${images.length > 1 ? `These ${images.length} images are consecutive slices (top to bottom, slightly overlapping) of ONE price board — never list a row twice.\n` : ""}Transcribe the coal price board.\n${FORMAT}\n\nRules:\n- ${RULES}`,
    },
  ];
  const read = (temperature: number) =>
    chatJson({ model: MODELS.vision, temperature, thinking: false, maxTokens: 6000, messages: [{ role: "system", content: CLERK }, { role: "user", content }] }, (v) => CompactSchema.parse(v));
  // Two reads in parallel; disagreements are flagged, not guessed. The main read is at
  // temperature 0 (repeatable); the checking read keeps a little randomness on purpose —
  // two identical reads would repeat the same mistake and the comparison would catch nothing.
  const [a, b] = await Promise.allSettled([read(0), read(0.3)]);
  if (a.status === "rejected" && b.status === "rejected") throw a.reason;
  const first = a.status === "fulfilled" ? a.value : (b as PromiseFulfilledResult<Awaited<ReturnType<typeof read>>>).value;
  const second = a.status === "fulfilled" && b.status === "fulfilled" ? b.value : null;
  const A = normalise(first.data);
  const B = second ? normalise(second.data) : null;
  return { ...A, uncertain: compareReads(A, B), model: first.model };
}

/* ---------------- 1b. text (sheets, CSV, PDF, pasted) ---------------- */

export async function readText(text: string): Promise<Extraction & { model: string }> {
  return (await remember(answerKey("read-text", text), () => readTextNow(text))).value;
}

async function readTextNow(text: string): Promise<Extraction & { model: string }> {
  const r = await chatJson(
    {
      model: MODELS.vision,
      temperature: 0,
      thinking: false,
      maxTokens: 6000,
      messages: [
        { role: "system", content: CLERK },
        { role: "user", content: `Extract any coal price assessments from the content below.\n${FORMAT}\n\nRules:\n- ${RULES}\n\nCONTENT:\n"""\n${text.slice(0, 60_000)}\n"""` },
      ],
    },
    (v) => CompactSchema.parse(v),
  );
  const x = normalise(r.data);
  // Grounding for extraction: every extracted number must exist in the source text.
  const src = text.replace(/,(?=\d{3}\b)/g, "");
  const present = (v: number) => [v.toFixed(2), v.toFixed(1), String(v), String(Math.round(v))].some((s) => src.includes(s));
  const uncertain = compareReads(x, null);
  for (const reg of x.regions) for (const row of reg.rows) for (const k of ["mid", "low", "high"] as const) if (!present(row[k])) uncertain.push(`${row.ref} ${k} ${row[k]} not found in the file`);
  return { ...x, uncertain, model: r.model };
}

/* ---------------- 2. upload analysis ---------------- */

const lines = (max: number) => z.array(z.coerce.string()).catch([]).transform((a) => a.map((s) => s.trim()).filter(Boolean).slice(0, max));
const AnalysisSchema = z
  .object({
    overview: z.coerce.string().catch(""),
    summary: z.union([lines(6), z.string().transform((s) => s.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).slice(0, 6))]).catch([]),
    highlights: lines(6),
    risks: lines(6),
  })
  .refine((a) => a.summary.length > 0 || a.overview.length > 0, "empty analysis");
export type Analysis = z.infer<typeof AnalysisSchema> & { model: string; ms: number; grounding: Grounding; saved?: boolean };

/**
 * `deep` turns on the model's reasoning mode. Measured on NVIDIA (Nov 2026): Ultra answers in
 * ~1.5 s with reasoning off vs ~23 s on, with the same accuracy on fact-grounded tasks — so it's
 * off by default; the facts are computed in code and every number is traced afterwards.
 */
export async function analyse(facts: Record<string, unknown>, deep = false): Promise<Analysis> {
  const r = await remember(answerKey("analysis", { facts, deep }), () => analyseNow(facts, deep));
  return { ...r.value, saved: r.saved };
}

async function analyseNow(facts: Record<string, unknown>, deep: boolean): Promise<Analysis> {
  const r = await chatJson(
    {
      // Fast path: Super (~90 tok/s). Deep: Ultra with reasoning (~54 tok/s + thinking).
      model: deep ? MODELS.reasoning : MODELS.vision,
      thinking: deep,
      temperature: 0,
      maxTokens: deep ? 16000 : 4000,
      messages: [
        {
          role: "system",
          content:
            "You are the senior analyst at Jakarta Coal Exchange, an independent coal price-discovery platform. You write for professional coal traders. You only state what the FACTS contain. If something is not in the facts, you do not mention it. No forecasts, no advice, no speculation about causes.",
        },
        {
          role: "user",
          content: `An editor uploaded new material. Using ONLY the FACTS (JSON) below, write:
- "overview": 1–2 sentences — what was uploaded and what it contains.
- "summary": 3–5 short paragraphs (max 55 words each) summarising the content: the key prices, the biggest changes versus the live board, and how the headline compares with the government HBA when the facts include it.
- "highlights": up to 5 one-line bullet facts with exact figures.
- "risks": up to 5 one-line issues the editor must check (from checks, uncertain cells and notes). Empty if none.
Quote figures exactly as given ($ and /t for prices). Reply with ONLY a JSON object with those four keys.

FACTS:
${JSON.stringify(facts)}`,
        },
      ],
    },
    (v) => AnalysisSchema.parse(v),
  );
  const text = [r.data.overview, ...r.data.summary, ...r.data.highlights].join("\n");
  return { ...r.data, model: r.model, ms: r.ms, grounding: groundText(text, facts) };
}

/* ---------------- 3. market brief ---------------- */

export function briefFacts(board: Board) {
  const stats = hbaStats(board.hba);
  const head = allRows(board).find((r) => r.ref === "SCR#1");
  const same = sameDayHba(board);
  return {
    assessmentDate: board.meta.assessmentDate,
    nextUpdate: board.meta.nextUpdate,
    nextUpdateHasPassed: Date.parse(board.meta.nextUpdate) < Date.now(),
    board: allRows(board).map((r) => ({ ref: r.ref, region: r.region.label, origin: r.origin, spec: `${r.spec} ${r.region.basis}`, mid: r.mid, low: r.low, high: r.high })),
    ladderSlopePer100kcal: ladderSlope(board) ? Number(ladderSlope(board)!.perStep.toFixed(2)) : null,
    // Gaps computed here so the AI quotes them instead of doing arithmetic (and the publish gate can verify them).
    nar6000Ranking: nar6000(board).map((r, _, all) => ({ name: r.name, mid: r.mid, belowTop: Number((all[0].mid - r.mid).toFixed(2)) })),
    scr1VsHbaSamePeriod:
      head && same?.value != null
        ? { hbaPeriod: same.period, hba: same.value, scr1: head.mid, gap: Number((head.mid - same.value).toFixed(2)), gapPct: Number((((head.mid - same.value) / same.value) * 100).toFixed(1)) }
        : null,
    hba: stats && {
      latest: { period: stats.last.period, value: stats.last.value },
      previous: stats.prev && { period: stats.prev.period, value: stats.prev.value, change: Number((stats.change ?? 0).toFixed(2)) },
      peak: { period: stats.peak.period, value: stats.peak.value },
      revisionsSincePeak: stats.sincePeak,
      risesThisYear: stats.ups,
      revisionsThisYear: stats.pairs.length,
      averageMove: Number(stats.avgMove.toFixed(2)),
      changeSinceAssessmentPeriod: same?.value != null ? Number((stats.last.value - same.value).toFixed(2)) : null,
    },
  };
}

/**
 * Publish gate: every number in the brief must exist in the data it can legitimately quote —
 * the draft, the live board, the exact before/after changes between them, the ladder and the
 * HBA ledger. Deliberately no "derived" matching: with hundreds of known numbers, almost any
 * invented figure equals the difference of some pair, so that would let nearly everything through.
 */
export function checkBriefNumbers(draft: Board, live: Board): Grounding {
  const text = draft.brief.paragraphs.join("\n");
  if (!text.trim()) return { checked: 0, unverified: [] };
  const facts = {
    draft: briefFacts(draft),
    live: briefFacts(live),
    changesVsLive: diffRows(live, draft.regions),
    ladder: draft.ladder.map(({ spec, mid, low, high }) => ({ spec, mid, low, high })),
    hba: draft.hba.map((p) => p.value),
  };
  return groundText(text, facts);
}

type DraftedBrief = { paragraphs: string[]; model: string; grounding: Grounding };

/**
 * Same board → the saved draft. `another` asks for a different wording of the same facts
 * (the "Regenerate" button): it runs at a little temperature and replaces the saved draft.
 */
export async function draftBrief(board: Board, deep = false, another = false): Promise<DraftedBrief & { saved: boolean }> {
  const facts = briefFacts(board);
  const key = answerKey("brief", { facts, deep });
  // A different wording only makes sense if a draft for exactly these facts already exists;
  // after the prices change, "Regenerate" is just a normal temperature-0 draft.
  const variant = another && (await hasSavedAnswer(key));
  const r = await remember(key, () => draftBriefNow(facts, deep, variant ? 0.4 : 0), { fresh: variant });
  return { ...r.value, saved: r.saved };
}

async function draftBriefNow(facts: ReturnType<typeof briefFacts>, deep: boolean, temperature: number): Promise<DraftedBrief> {
  const r = await chatJson(
    {
      // Fast path: Super (~90 tok/s). Deep: Ultra with reasoning (~54 tok/s + thinking).
      model: deep ? MODELS.reasoning : MODELS.vision,
      thinking: deep,
      temperature,
      maxTokens: deep ? 12000 : 3000,
      messages: [
        { role: "system", content: "You write the weekly market brief for Jakarta Coal Exchange. Use only the FACTS provided. No forecasts, no trading advice, no causes the facts do not state." },
        {
          role: "user",
          content: `Write 3–5 short paragraphs (max 55 words each) for professional coal traders. Lead with SCR#1 and its gap to the HBA for the same period, then the GAR ladder, the NAR board, and the HBA trend. Quote exact figures with $ and /t. If nextUpdateHasPassed is true, say a fresh assessment is due. Reply with ONLY {"paragraphs": ["..."]}.\n\nFACTS:\n${JSON.stringify(facts)}`,
        },
      ],
    },
    (v) => z.object({ paragraphs: z.array(z.string().min(1)).min(1).max(6) }).parse(v),
  );
  return { paragraphs: r.data.paragraphs, model: r.model, grounding: groundText(r.data.paragraphs.join("\n"), facts) };
}

/* ---------------- 4. connection test ---------------- */

export async function testModels() {
  const out: { role: string; model: string; ok: boolean; ms: number; detail: string }[] = [];
  for (const [role, model] of Object.entries(MODELS)) {
    const t0 = Date.now();
    try {
      const r = await chat({ model, thinking: false, maxTokens: 20, temperature: 0, timeoutMs: 60_000, messages: [{ role: "user", content: "Reply with the single word OK." }] });
      out.push({ role, model: r.used, ok: r.used === model, ms: r.ms, detail: r.used === model ? r.text.slice(0, 40) : `unavailable — answered by ${r.used}` });
    } catch (e) {
      out.push({ role, model, ok: false, ms: Date.now() - t0, detail: e instanceof Error ? e.message.slice(0, 160) : "failed" });
    }
  }
  return out;
}
