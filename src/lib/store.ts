import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { put } from "@vercel/blob";
import { SEED_BOARD } from "./seed";
import type { AuditEntry, Board, HistoryEntry, PendingHba, UploadAnalysis } from "./types";

/**
 * Storage with three interchangeable drivers, chosen from the environment:
 *
 *  redis    – Upstash Redis (Vercel Marketplace). Used on Vercel.
 *  file     – JSON files in ./.data (local dev, or any Node host with a
 *             writable disk such as a Hostinger VPS / Node.js plan).
 *  readonly – Vercel without Redis: the site serves the seed data and the
 *             admin panel explains how to connect storage.
 *
 * Images go to Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise to
 * public/uploads in file mode.
 */

export type StoreMode = "redis" | "file" | "readonly";

const KEYS = {
  published: "jce:published",
  draft: "jce:draft",
  history: "jce:history",
  pending: "jce:pending",
  audit: "jce:audit",
  uploads: "jce:uploads",
} as const;
type Key = (typeof KEYS)[keyof typeof KEYS];

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function storeMode(): StoreMode {
  if (process.env.JCE_STORAGE === "file") return "file";
  if (redisUrl && redisToken) return "redis";
  if (process.env.VERCEL) return "readonly";
  return "file";
}

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

let redis: Redis | null = null;
function client() {
  if (!redis) redis = new Redis({ url: redisUrl!, token: redisToken! });
  return redis;
}

const dataDir = () => path.join(process.cwd(), ".data");
const fileFor = (key: Key) => path.join(dataDir(), key.replace(":", "-") + ".json");

async function read<T>(key: Key): Promise<T | null> {
  const mode = storeMode();
  try {
    if (mode === "redis") return (await client().get<T>(key)) ?? null;
    if (mode === "file") {
      const raw = await fs.readFile(fileFor(key), "utf8");
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") console.error(`[store] read ${key} failed`, err);
  }
  return null;
}

export class ReadOnlyStoreError extends Error {
  constructor() {
    super("Storage is not connected. Add Upstash Redis in Vercel → Storage, then redeploy.");
  }
}

async function write<T>(key: Key, value: T): Promise<void> {
  const mode = storeMode();
  if (mode === "readonly") throw new ReadOnlyStoreError();
  if (mode === "redis") {
    await client().set(key, value);
    return;
  }
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(fileFor(key), JSON.stringify(value, null, 2), "utf8");
}

async function del(key: Key): Promise<void> {
  const mode = storeMode();
  if (mode === "readonly") throw new ReadOnlyStoreError();
  if (mode === "redis") {
    await client().del(key);
    return;
  }
  await fs.rm(fileFor(key), { force: true });
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/* ---------------- boards ---------------- */

export async function getPublished(): Promise<Board> {
  return (await read<Board>(KEYS.published)) ?? clone(SEED_BOARD);
}

export async function getDraft(): Promise<{ board: Board; isDraft: boolean }> {
  const draft = await read<Board>(KEYS.draft);
  if (draft) return { board: draft, isDraft: true };
  return { board: await getPublished(), isDraft: false };
}

export async function saveDraft(board: Board) {
  await write(KEYS.draft, board);
}

export async function discardDraft() {
  await del(KEYS.draft);
}

export async function publishDraft(by: string): Promise<Board> {
  const { board } = await getDraft();
  const current = await getPublished();
  const next: Board = {
    ...board,
    meta: { ...board.meta, publishedAt: new Date().toISOString(), version: (current.meta.version ?? 0) + 1 },
  };
  await write(KEYS.published, next);
  await del(KEYS.draft);

  const history = await getHistory();
  const prices: Record<string, number> = {};
  for (const r of next.regions) for (const row of r.rows) prices[row.ref] = row.mid;
  history.unshift({ publishedAt: next.meta.publishedAt!, assessmentDate: next.meta.assessmentDate, version: next.meta.version, prices });
  await write(KEYS.history, history.slice(0, 104));
  await audit(`Published v${next.meta.version}`, `Assessment ${next.meta.assessmentDate} by ${by}`);
  return next;
}

/* ---------------- history / pending / audit ---------------- */

export async function getHistory(): Promise<HistoryEntry[]> {
  return (await read<HistoryEntry[]>(KEYS.history)) ?? [];
}

export async function getPending(): Promise<PendingHba[]> {
  return (await read<PendingHba[]>(KEYS.pending)) ?? [];
}

export async function savePending(items: PendingHba[]) {
  await write(KEYS.pending, items);
}

export async function getAudit(): Promise<AuditEntry[]> {
  return (await read<AuditEntry[]>(KEYS.audit)) ?? [];
}

export async function audit(action: string, detail?: string) {
  if (storeMode() === "readonly") return;
  const log = await getAudit();
  log.unshift({ at: new Date().toISOString(), action, detail });
  await write(KEYS.audit, log.slice(0, 200));
}

/* ---------------- upload analyses ---------------- */

export async function getUploads(): Promise<UploadAnalysis[]> {
  return (await read<UploadAnalysis[]>(KEYS.uploads)) ?? [];
}

export async function saveUpload(item: UploadAnalysis) {
  const list = (await getUploads()).filter((u) => u.id !== item.id);
  list.unshift(item);
  await write(KEYS.uploads, list.slice(0, 25));
}

/* ---------------- saved AI answers ---------------- */
// Same question + same data → same answer. Keys are content hashes (see ai-cache.ts), so a
// changed board, prompt or model simply produces a new key; old entries expire on their own.

const AI_TTL_S = 30 * 24 * 3600;
const memoryAi = new Map<string, unknown>();
const aiFile = (key: string) => path.join(dataDir(), "ai-cache", key.replace(/[^a-z0-9_-]/gi, "_") + ".json");

export async function getSavedAnswer<T>(key: string): Promise<T | null> {
  const mode = storeMode();
  try {
    if (mode === "redis") return (await client().get<T>(`jce:ai:${key}`)) ?? null;
    if (mode === "file") return JSON.parse(await fs.readFile(aiFile(key), "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") console.error("[store] saved answer read failed", err);
    return null;
  }
  return (memoryAi.get(key) as T | undefined) ?? null;
}

export async function saveAnswer(key: string, value: unknown): Promise<void> {
  const mode = storeMode();
  try {
    if (mode === "redis") return void (await client().set(`jce:ai:${key}`, value, { ex: AI_TTL_S }));
    if (mode === "file") {
      await fs.mkdir(path.dirname(aiFile(key)), { recursive: true });
      return void (await fs.writeFile(aiFile(key), JSON.stringify(value), "utf8"));
    }
  } catch (err) {
    console.error("[store] saved answer write failed", err); // never block an answer on the cache
    return;
  }
  // Read-only deployment: keep a small per-instance memory cache.
  memoryAi.set(key, value);
  if (memoryAi.size > 200) memoryAi.delete(memoryAi.keys().next().value!);
}

/* ---------------- login throttling ---------------- */

const FAIL_WINDOW_S = 15 * 60;
const memoryFails = new Map<string, { n: number; until: number }>();

export async function loginFailures(id: string): Promise<number> {
  if (storeMode() === "redis") return Number((await client().get<number>(`jce:loginfail:${id}`)) ?? 0);
  const e = memoryFails.get(id);
  return e && e.until > Date.now() ? e.n : 0;
}

export async function recordLoginFailure(id: string): Promise<number> {
  if (storeMode() === "redis") {
    const key = `jce:loginfail:${id}`;
    const n = await client().incr(key);
    if (n === 1) await client().expire(key, FAIL_WINDOW_S);
    return n;
  }
  const e = memoryFails.get(id);
  const n = e && e.until > Date.now() ? e.n + 1 : 1;
  memoryFails.set(id, { n, until: Date.now() + FAIL_WINDOW_S * 1000 });
  return n;
}

export async function clearLoginFailures(id: string) {
  if (storeMode() === "redis") await client().del(`jce:loginfail:${id}`);
  else memoryFails.delete(id);
}

/* ---------------- images ---------------- */

/** Keep a copy of an uploaded file (Vercel Blob, or public/uploads in file mode). */
export async function storeFile(file: File): Promise<string> {
  const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-60);
  const name = `uploads/${Date.now()}-${safe}`;
  if (blobEnabled()) {
    const blob = await put(name, file, { access: "public", contentType: file.type || "application/octet-stream", addRandomSuffix: true });
    return blob.url;
  }
  if (storeMode() === "file") {
    const dir = path.join(process.cwd(), "public", "uploads", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(process.cwd(), "public", "uploads", name), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${name}`;
  }
  throw new ReadOnlyStoreError();
}
