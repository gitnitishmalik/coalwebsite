import * as z from "zod";

/** Validation for everything the admin panel sends to the server. */

const money = z.number().finite().min(0).max(10_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const AssessmentSchema = z.object({
  ref: z.string().trim().min(1).max(20),
  origin: z.string().trim().min(1).max(60),
  spec: z.number().int().min(1000).max(9000),
  mid: money,
  low: money,
  high: money,
  note: z.string().max(200).nullish(),
});

export const RegionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  basis: z.enum(["GAR", "NAR"]),
  rows: z.array(AssessmentSchema).max(80),
});

export const LadderSchema = z.object({
  spec: z.number().int().min(1000).max(9000),
  mid: money,
  low: money,
  high: money,
  ref: z.string().max(20).nullish(),
  reconstructed: z.boolean().optional(),
});

export const SourceSchema = z.object({ name: z.string().trim().min(1).max(80), url: z.url().max(500) });

export const HbaSchema = z.object({
  period: z.string().trim().regex(/^[A-Z][a-z]{2}-(I|II)$/, "Use e.g. Nov-II"),
  date: isoDate,
  value: money.nullable(),
  status: z.enum(["official", "corroborated", "single", "derived", "missing"]),
  sources: z.array(SourceSchema).max(10),
});

export const BoardSchema = z.object({
  meta: z.object({ assessmentDate: isoDate, nextUpdate: isoDate, publishedAt: z.string().nullable(), version: z.number().int().min(0) }),
  regions: z.array(RegionSchema).min(1).max(12),
  ladder: z.array(LadderSchema).max(80),
  hba: z.array(HbaSchema).max(200),
  brief: z.object({
    paragraphs: z.array(z.string().trim().max(800)).max(8),
    generatedAt: z.string().nullable(),
    model: z.string().nullable(),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().nullable(),
  }),
  settings: z.object({
    announcement: z.string().trim().max(200).nullable(),
    contactEmail: z.email(),
    boardImageUrl: z.string().max(600).nullable(),
  }),
});
