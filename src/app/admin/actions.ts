"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { endSession, requireAdmin } from "@/lib/auth";
import { aiEnabled, draftBrief, extractBoard, AI_MODEL, type Extracted } from "@/lib/ai";
import { runHbaSearch } from "@/lib/hba-search";
import { BoardSchema, HbaSchema } from "@/lib/schema";
import { audit, discardDraft, getDraft, getPending, publishDraft, ReadOnlyStoreError, saveDraft, savePending, storeImage } from "@/lib/store";
import type { Board, HbaPoint } from "@/lib/types";

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
    const board = parseBoard(input);
    await saveDraft(board);
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

/* ---------------- AI: board image ---------------- */

export async function extractImageAction(form: FormData): Promise<ActionResult<{ extracted: Extracted; imageUrl: string | null }>> {
  const me = await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "AI is off. Add ANTHROPIC_API_KEY to the environment to read images automatically." };
    const file = form.get("image");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose an image first." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false, error: "Use a JPEG, PNG or WebP image." };
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Image is larger than 10 MB." };
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const extracted = await extractBoard({ data, mediaType: file.type as "image/jpeg" | "image/png" | "image/webp" });
    let imageUrl: string | null = null;
    try {
      imageUrl = await storeImage(file);
    } catch {
      imageUrl = null; // storage optional for extraction
    }
    await audit("AI read a price-board image", `${file.name} by ${me.user}`);
    return { ok: true, data: { extracted, imageUrl } };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- AI: brief ---------------- */

export async function draftBriefAction(input: Board): Promise<ActionResult<{ paragraphs: string[]; model: string }>> {
  const me = await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "AI is off. Add ANTHROPIC_API_KEY to the environment." };
    const board = parseBoard(input);
    const paragraphs = await draftBrief(board);
    await audit("AI drafted the market brief", me.user);
    return { ok: true, data: { paragraphs, model: AI_MODEL } };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- AI: HBA search + approvals ---------------- */

export async function searchHbaAction(): Promise<ActionResult<{ added: number; note: string }>> {
  const me = await requireAdmin();
  try {
    if (!aiEnabled()) return { ok: false, error: "AI is off. Add ANTHROPIC_API_KEY to the environment." };
    const { added, note } = await runHbaSearch("ai-search");
    await audit("AI searched for new HBA releases", `${added} new by ${me.user}`);
    refreshAdmin();
    return { ok: true, data: { added, note }, message: added ? `${added} new HBA value${added > 1 ? "s" : ""} waiting for approval.` : "No new HBA releases found." };
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
    const i = board.hba.findIndex((p) => p.period === point.period && p.date === point.date);
    if (i >= 0) {
      const merged = [...board.hba[i].sources];
      for (const s of point.sources) if (!merged.some((m) => m.url === s.url)) merged.push(s);
      board.hba[i] = { ...point, sources: merged, status: point.status === "single" && merged.length >= 2 ? "corroborated" : point.status };
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
