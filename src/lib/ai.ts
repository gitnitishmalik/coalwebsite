import "server-only";
import * as z from "zod";
import { allRows, hbaStats, ladderSlope, nar6000, sameDayHba } from "./analytics";
import { groundText, type Grounding } from "./grounding";
import { chat, chatJson, MODELS, nvidiaEnabled, type ContentPart } from "./nvidia";
import type { Board, LadderPoint, Region } from "./types";

/**
 * AI features on NVIDIA's hosted models.
 *  - readImages / readText: turn an uploaded board (image, sheet, PDF, text) into rows
 *  - analyse: overview + summary of an upload, written only from computed facts
 *  - draftBrief: weekly market brief from the board's own numbers
 * Hallucination guards: low temperature, facts computed in code, images read twice
 * and compared, and every number in AI text traced back to the data (grounding).
 */

export { MODELS };
export const aiEnabled = nvidiaEnabled;

/* ---------------- shared schema ---------------- */

const num = z.coerce.number().finite();
const RowSchema = z.object({
  ref: z.string().min(1),
  origin: z.string().default(""),
  spec: num,
  mid: num,
  low: num,
  high: num,
  unreadable: z.boolean().optional().default(false),
});
const ExtractSchema = z.object({
  assessmentDate: z.string().nullable().optional().default(null),
  regions: z.array(z.object({ label: z.string().min(1), basis: z.enum(["GAR", "NAR"]).catch("NAR"), rows: z.array(RowSchema) })).default([]),
  ladder: z.array(z.object({ spec: num, mid: num, low: num, high: num, ref: z.string().nullable().optional(), unreadable: z.boolean().optional().default(false) })).default([]),
  notes: z.array(z.string()).default([]),
});
type RawExtract = z.infer<typeof ExtractSchema>;

export interface Extraction {
  assessmentDate: string | null;
  regions: Region[];
  ladder: LadderPoint[];
  notes: string[];
  uncertain: string[];
}

const SCHEMA_TEXT = `{
  "assessmentDate": "YYYY-MM-DD or null",
  "regions": [ { "label": "Indonesia", "basis": "GAR" | "NAR",
                 "rows": [ { "ref": "SCR#1", "origin": "Indonesia", "spec": 6322, "mid": 117.72, "low": 116.54, "high": 118.90, "unreadable": false } ] } ],
  "ladder": [ { "spec": 6200, "mid": 113.79, "low": 112.65, "high": 114.92, "ref": null, "unreadable": false } ],
  "notes": [ "anything an editor should know" ]
}`;

const RULES = [
  "Transcribe ONLY what is printed. Never invent, estimate or fill in missing rows.",
  "low/high = the two <<RANGE>> values in the order printed (left = low, right = high). Do not reorder them even if they look swapped.",
  "A ladder table has rows labelled 'Ladder' between SCR anchors: put every ladder line in `ladder` (anchors too, with ref = 'SCR#n' and spec = the anchor's calorific value).",
  "If a value is covered or unclear, give your best reading and set unreadable = true.",
  "If the content contains no coal price table, return empty arrays and explain in notes.",
  "Reply with ONLY the JSON object.",
].join("\n- ");

function normalise(x: RawExtract): Omit<Extraction, "uncertain"> {
  return {
    assessmentDate: x.assessmentDate && /^\d{4}-\d{2}-\d{2}$/.test(x.assessmentDate) ? x.assessmentDate : null,
    regions: x.regions
      .filter((r) => r.rows.length)
      .map((r) => ({
        id: r.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        label: r.label.replace(/\s+/g, " ").trim(),
        basis: r.basis,
        rows: r.rows.map((row) => ({
          ref: row.ref.replace(/\s+/g, ""),
          origin: row.origin.trim(),
          spec: Math.round(row.spec),
          mid: row.mid,
          low: row.low,
          high: row.high,
          note: row.unreadable ? "Unreadable in source — check" : null,
        })),
      })),
    ladder: x.ladder.map((p) => ({ spec: Math.round(p.spec), mid: p.mid, low: p.low, high: p.high, ref: p.ref ? p.ref.replace(/\s+/g, "") : null, reconstructed: !!p.unreadable })),
    notes: x.notes,
  };
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
  }
  return out;
}

/* ---------------- 1a. images ---------------- */

export async function readImages(images: string[]): Promise<Extraction & { model: string }> {
  const content: ContentPart[] = [
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text",
      text: `${images.length > 1 ? `These ${images.length} images are consecutive slices (top to bottom, slightly overlapping) of ONE price board — do not duplicate rows that appear in two slices.\n` : ""}Transcribe the coal price board into this JSON shape:\n${SCHEMA_TEXT}\n\nRules:\n- ${RULES}`,
    },
  ];
  const read = (temperature: number) =>
    chatJson(
      { model: MODELS.vision, temperature, thinking: false, maxTokens: 12000, messages: [{ role: "system", content: "You are a meticulous data-entry clerk for a coal price-reporting agency. Accuracy over completeness." }, { role: "user", content }] },
      (v) => ExtractSchema.parse(v),
    );
  // Two independent reads in parallel; disagreements are flagged, not guessed.
  const [a, b] = await Promise.allSettled([read(0.1), read(0.35)]);
  if (a.status === "rejected" && b.status === "rejected") throw a.reason;
  const first = a.status === "fulfilled" ? a.value : (b as PromiseFulfilledResult<Awaited<ReturnType<typeof read>>>).value;
  const second = a.status === "fulfilled" && b.status === "fulfilled" ? b.value : null;
  const A = normalise(first.data);
  const B = second ? normalise(second.data) : null;
  return { ...A, uncertain: compareReads(A, B), model: first.model };
}

/* ---------------- 1b. text (sheets, CSV, PDF, pasted) ---------------- */

export async function readText(text: string): Promise<Extraction & { model: string }> {
  const r = await chatJson(
    {
      model: MODELS.vision,
      temperature: 0.1,
      thinking: false,
      maxTokens: 12000,
      messages: [
        { role: "system", content: "You are a meticulous data-entry clerk for a coal price-reporting agency. Accuracy over completeness." },
        { role: "user", content: `Extract any coal price assessments from the content below into this JSON shape:\n${SCHEMA_TEXT}\n\nRules:\n- ${RULES}\n\nCONTENT:\n"""\n${text.slice(0, 60_000)}\n"""` },
      ],
    },
    (v) => ExtractSchema.parse(v),
  );
  const x = normalise(r.data);
  // Grounding for extraction: every extracted number must exist in the source text.
  const src = text.replace(/,(?=\d{3}\b)/g, "");
  const present = (n: number) => [n.toFixed(2), n.toFixed(1), String(n), String(Math.round(n))].some((s) => src.includes(s));
  const uncertain = compareReads(x, null);
  for (const reg of x.regions) for (const row of reg.rows) for (const k of ["mid", "low", "high"] as const) if (!present(row[k])) uncertain.push(`${row.ref} ${k} ${row[k]} not found in the file`);
  return { ...x, uncertain, model: r.model };
}

/* ---------------- 2. upload analysis ---------------- */

const AnalysisSchema = z.object({
  overview: z.string().min(1),
  summary: z.array(z.string()).min(1).max(6),
  highlights: z.array(z.string()).max(6).default([]),
  risks: z.array(z.string()).max(6).default([]),
});
export type Analysis = z.infer<typeof AnalysisSchema> & { model: string; ms: number; grounding: Grounding };

export async function analyse(facts: Record<string, unknown>): Promise<Analysis> {
  const r = await chatJson(
    {
      model: MODELS.reasoning,
      thinking: true,
      temperature: 0.3,
      maxTokens: 16000,
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
    nar6000Ranking: nar6000(board).map((r) => ({ name: r.name, mid: r.mid })),
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

export async function draftBrief(board: Board): Promise<{ paragraphs: string[]; model: string; grounding: Grounding }> {
  const facts = briefFacts(board);
  const r = await chatJson(
    {
      model: MODELS.reasoning,
      thinking: true,
      temperature: 0.3,
      maxTokens: 12000,
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
      out.push({ role, model: r.model, ok: true, ms: r.ms, detail: r.text.slice(0, 40) });
    } catch (e) {
      out.push({ role, model, ok: false, ms: Date.now() - t0, detail: e instanceof Error ? e.message.slice(0, 160) : "failed" });
    }
  }
  return out;
}
