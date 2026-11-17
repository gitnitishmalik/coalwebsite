import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { Board, HbaPoint } from "./types";
import { allRows, hbaStats, ladderSlope, nar6000, sameDayHba } from "./analytics";

/**
 * Claude integration.
 *  - extractBoard: read an uploaded price-board image into structured rows
 *  - draftBrief:   write the market brief from the board's own numbers
 *  - searchHba:    find newly published HBA periods on the web, with sources
 *
 * Server-side refusal fallbacks are enabled ("default" routing), so a
 * declined request is retried on a fallback model inside the same call.
 */

export const AI_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client() {
  if (!aiEnabled()) throw new Error("ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  if (!_client) _client = new Anthropic({ timeout: 240_000, maxRetries: 2 });
  return _client;
}

function assertNotRefused(res: { stop_reason: string | null }) {
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (res.stop_reason === "max_tokens") throw new Error("The response was cut off. Try a smaller image or fewer rows.");
}

/* ---------------- 1. board image → rows ---------------- */

const ExtractRow = z.object({
  ref: z.string(),
  origin: z.string(),
  spec: z.number(),
  mid: z.number(),
  low: z.number(),
  high: z.number(),
  unreadable: z.boolean(),
});
const ExtractSchema = z.object({
  assessmentDate: z.string().nullable(),
  regions: z.array(z.object({ label: z.string(), basis: z.enum(["GAR", "NAR"]), rows: z.array(ExtractRow) })),
  ladder: z.array(
    z.object({ spec: z.number(), mid: z.number(), low: z.number(), high: z.number(), ref: z.string().nullable(), unreadable: z.boolean() }),
  ),
  notes: z.array(z.string()),
});
export type Extracted = z.infer<typeof ExtractSchema>;

export async function extractBoard(image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }): Promise<Extracted> {
  const res = await client().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(ExtractSchema) },
    system:
      "You transcribe coal price boards for Jakarta Coal Exchange. Accuracy matters more than completeness: a wrong number is worse than a flagged one.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          {
            type: "text",
            text: [
              "Transcribe this coal price board into the schema.",
              "- regions: each headed section (e.g. Indonesia GAR, South America NAR, Russia NAR, USA NAR). One row per printed line with a reference (SCR#n).",
              "- low/high: the two <<RANGE>> values exactly in the order printed (left = low, right = high). Do NOT reorder them even if they look swapped.",
              "- ladder: if there is a ladder table (rows labelled 'Ladder' between SCR anchors), put every ladder line there, including the SCR anchor rows (ref = 'SCR#n', spec = the anchor's calorific value).",
              "- If a number is covered or unreadable, give your best reading and set unreadable = true.",
              "- assessmentDate: an ISO date if one is printed, else null.",
              "- notes: anything an editor should know (watermarks, duplicate tables, missing references).",
            ].join("\n"),
          },
        ],
      },
    ],
  });
  assertNotRefused(res);
  if (!res.parsed_output) throw new Error("Could not read a price table from this image.");
  return res.parsed_output;
}

/* ---------------- 2. market brief ---------------- */

const BriefSchema = z.object({ paragraphs: z.array(z.string()) });

export async function draftBrief(board: Board): Promise<string[]> {
  const stats = hbaStats(board.hba);
  const facts = {
    assessmentDate: board.meta.assessmentDate,
    nextUpdate: board.meta.nextUpdate,
    board: allRows(board).map((r) => ({ ref: r.ref, region: r.region.label, origin: r.origin, spec: `${r.spec} ${r.region.basis}`, mid: r.mid, low: r.low, high: r.high })),
    ladderSlopePer100kcal: ladderSlope(board)?.perStep ?? null,
    nar6000Ranking: nar6000(board).map((r) => ({ name: r.name, mid: r.mid })),
    hbaSamePeriodAsAssessment: sameDayHba(board),
    hba: stats && {
      latest: { period: stats.last.period, value: stats.last.value },
      previous: stats.prev && { period: stats.prev.period, value: stats.prev.value },
      peak: { period: stats.peak.period, value: stats.peak.value },
      revisionsSincePeak: stats.sincePeak,
      risesThisYear: `${stats.ups} of ${stats.pairs.length}`,
      averageMove: stats.avgMove,
    },
  };
  const res = await client().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(BriefSchema) },
    system:
      "You write the weekly market brief for Jakarta Coal Exchange, an independent coal price-discovery platform. Use only the figures provided. No forecasts, no trading advice, no adjectives the numbers do not support.",
    messages: [
      {
        role: "user",
        content:
          "Write 3–5 short paragraphs (max 55 words each) for professional coal traders. Lead with the SCR#1 assessment and its gap to the HBA for the same period, then the GAR ladder, the NAR board, and the HBA trend. Quote exact figures with $ and /t. If the next-update date is in the past, say a fresh assessment is due.\n\nData:\n" +
          JSON.stringify(facts),
      },
    ],
  });
  assertNotRefused(res);
  const paragraphs = res.parsed_output?.paragraphs?.filter((p) => p.trim()) ?? [];
  if (!paragraphs.length) throw new Error("The model returned an empty brief.");
  return paragraphs;
}

/* ---------------- 3. HBA web search ---------------- */

const FindingSchema = z.object({
  findings: z.array(
    z.object({
      period: z.string(),
      date: z.string(),
      value: z.number(),
      ministryConfirmed: z.boolean(),
      sources: z.array(z.object({ name: z.string(), url: z.string() })),
    }),
  ),
  note: z.string(),
});
export type HbaFinding = z.infer<typeof FindingSchema>["findings"][number];

const RECORD_TOOL = {
  name: "record_hba_findings",
  description: "Record the HBA (6,322 GAR) values you found, each with the URLs that state it. Call exactly once, at the end.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            period: { type: "string", description: "Mon-I or Mon-II, e.g. Nov-II" },
            date: { type: "string", description: "ISO date the price applies from: the 1st for period I, the 15th for period II" },
            value: { type: "number", description: "USD per tonne for 6,322 GAR" },
            ministryConfirmed: { type: "boolean", description: "true only if an esdm.go.id page states the value" },
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, url: { type: "string" } },
                required: ["name", "url"],
                additionalProperties: false,
              },
            },
          },
          required: ["period", "date", "value", "ministryConfirmed", "sources"],
          additionalProperties: false,
        },
      },
      note: { type: "string", description: "Anything uncertain or conflicting between sources" },
    },
    required: ["findings", "note"],
    additionalProperties: false,
  },
};

const HBA_DOMAINS = [
  "esdm.go.id",
  "news.ddtc.co.id",
  "ima-api.org",
  "kontan.co.id",
  "detik.com",
  "cnbcindonesia.com",
  "bisnis.com",
  "listrikindonesia.com",
  "petromindo.com",
  "katadata.co.id",
];

export async function searchHba(known: HbaPoint[]): Promise<{ findings: HbaFinding[]; note: string }> {
  const have = known.filter((p) => p.value != null).map((p) => `${p.period} ${p.date.slice(0, 4)}`);
  const latest = [...known].filter((p) => p.value != null).sort((a, b) => a.date.localeCompare(b.date)).pop();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content:
        `Find Indonesia's Harga Batubara Acuan (HBA) for the 6,322 kcal/kg GAR category for any period AFTER ${latest?.period ?? "Jan-I"} ${latest?.date.slice(0, 4) ?? "2026"}, ` +
        `plus any of these unverified periods: ${known.filter((p) => p.value == null).map((p) => p.period).join(", ") || "none"}. ` +
        `Already recorded: ${have.join(", ")}. Search in Indonesian and English (e.g. "HBA periode II November 2026"). ` +
        "Only record a value if a page you opened states it explicitly; give every URL that states it. Prefer esdm.go.id. " +
        "When done, call record_hba_findings once. If nothing new is published yet, call it with an empty findings list.",
    },
  ];

  for (let turn = 0; turn < 4; turn++) {
    const res = await client().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: HBA_DOMAINS }, RECORD_TOOL],
      messages,
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    const call = res.content.find((b) => b.type === "tool_use" && b.name === RECORD_TOOL.name);
    if (call && call.type === "tool_use") {
      const parsed = FindingSchema.safeParse(call.input);
      if (!parsed.success) throw new Error("The search result was not in the expected format.");
      return parsed.data;
    }
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({ role: "user", content: "Please call record_hba_findings now with what you found." });
  }
  throw new Error("The search did not finish. Try again later.");
}
