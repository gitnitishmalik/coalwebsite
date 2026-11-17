import { aiEnabled } from "@/lib/ai";
import { runHbaSearch } from "@/lib/hba-search";
import { audit, storeMode } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Finds new HBA releases and queues them for editor approval — never publishes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!aiEnabled()) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 503 });
  if (storeMode() === "readonly") return Response.json({ ok: false, error: "storage not connected" }, { status: 503 });
  try {
    const { added, note } = await runHbaSearch("cron");
    await audit("Daily HBA search", `${added} new value${added === 1 ? "" : "s"} queued`);
    return Response.json({ ok: true, added, note });
  } catch (err) {
    console.error("[cron/hba]", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
