export type Basis = "GAR" | "NAR";

export interface Assessment {
  ref: string;
  origin: string;
  spec: number;
  mid: number;
  low: number;
  high: number;
  note?: string | null;
}

export interface Region {
  id: string;
  label: string;
  basis: Basis;
  rows: Assessment[];
}

export interface LadderPoint {
  spec: number;
  mid: number;
  low: number;
  high: number;
  ref?: string | null;
  reconstructed?: boolean;
}

export type HbaStatus = "official" | "corroborated" | "single" | "derived" | "missing";

export interface SourceLink {
  name: string;
  url: string;
}

export interface HbaPoint {
  period: string; // e.g. "Nov-I"
  date: string; // ISO yyyy-mm-dd (first day the price applies)
  value: number | null; // USD/t, 6,322 GAR
  status: HbaStatus;
  sources: SourceLink[];
}

export interface Brief {
  paragraphs: string[];
  generatedAt: string | null;
  model: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface SiteSettings {
  announcement: string | null;
  contactEmail: string;
  boardImageUrl: string | null;
}

export interface BoardMeta {
  assessmentDate: string;
  nextUpdate: string;
  publishedAt: string | null;
  version: number;
}

export interface Board {
  meta: BoardMeta;
  regions: Region[];
  ladder: LadderPoint[];
  hba: HbaPoint[];
  brief: Brief;
  settings: SiteSettings;
}

export interface HistoryEntry {
  publishedAt: string;
  assessmentDate: string;
  version: number;
  prices: Record<string, number>; // ref -> mid
}

export interface PendingHba extends HbaPoint {
  id: string;
  foundAt: string;
  foundBy: "ai-search" | "cron";
  note?: string | null;
}

export interface AuditEntry {
  at: string;
  action: string;
  detail?: string;
}

export type CheckLevel = "critical" | "warning" | "info" | "pass";

export interface Check {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
}

export interface FxRate {
  rate: number;
  date: string;
  live: boolean;
  source: string;
}
