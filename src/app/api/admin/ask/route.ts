import { briefFacts, MODELS } from "@/lib/ai";
import { answerKey } from "@/lib/ai-cache";
import { currentAdmin } from "@/lib/auth";
import { groundText } from "@/lib/grounding";
import { chatStream, nvidiaEnabled } from "@/lib/nvidia";
import { getDraft, getHistory, getPending, getPublished, getSavedAnswer, getUploads, saveAnswer } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * "Ask the data" — streams an answer grounded in the board, HBA ledger,
 * publish history and recent uploads. After the text, a NUL byte and a JSON
 * trailer carry the model, timing and the number-grounding result.
 */
export async function POST(req: Request) {
  const me = await currentAdmin();
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!nvidiaEnabled()) return new Response("AI is off — add NVIDIA_API_KEY.", { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { question?: unknown; source?: unknown; history?: unknown };
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 600) : "";
  if (!question) return new Response("Ask a question.", { status: 400 });
  const useDraft = body.source === "draft";
  const prior = Array.isArray(body.history)
    ? (body.history as { q?: unknown; a?: unknown }[]).slice(-4).flatMap((t) =>
        typeof t.q === "string" && typeof t.a === "string"
          ? [{ role: "user" as const, content: t.q.slice(0, 600) }, { role: "assistant" as const, content: t.a.slice(0, 1500) }]
          : [],
      )
    : [];

  const [live, { board: draft }, pending, uploads, history] = await Promise.all([getPublished(), getDraft(), getPending(), getUploads(), getHistory()]);
  const board = useDraft ? draft : live;
  const facts = {
    today: new Date().toISOString().slice(0, 10),
    dataset: useDraft ? "editor draft (not yet published)" : "live published board",
    ...briefFacts(board),
    ladder: board.ladder.map((p) => ({ gar: p.spec, mid: p.mid, low: p.low, high: p.high, ref: p.ref ?? undefined, reconstructed: p.reconstructed || undefined })),
    hbaLedger: board.hba.map((p) => ({ period: p.period, from: p.date, value: p.value, status: p.status, sources: p.sources.length })),
    hbaAwaitingApproval: pending.map((p) => ({ period: p.period, from: p.date, value: p.value, status: p.status, sources: p.sources.length })),
    publishHistory: history.slice(0, 12).map((h) => ({ version: h.version, assessmentDate: h.assessmentDate, publishedAt: h.publishedAt.slice(0, 10), scr1: h.prices["SCR#1"] })),
    recentUploads: uploads.slice(0, 3).map((u) => ({ at: u.at.slice(0, 10), files: u.files.map((f) => f.name), overview: u.ai?.overview })),
  };

  // Same question (ignoring case/spacing) + same data + same conversation → the saved answer.
  const key = answerKey("ask", { q: question.replace(/\s+/g, " ").toLowerCase(), facts, prior });
  const saved = await getSavedAnswer<{ text: string; model: string }>(key);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      if (saved) {
        controller.enqueue(encoder.encode(saved.text));
        const grounding = groundText(saved.text, facts, { derived: true });
        controller.enqueue(encoder.encode("\u0000" + JSON.stringify({ model: saved.model, ms: Date.now() - t0, grounding, error: null, saved: true })));
        controller.close();
        return;
      }
      let text = "", model = MODELS.reasoning, error: string | null = null;
      try {
        const gen = chatStream({
          model: MODELS.reasoning,
          thinking: false,
          temperature: 0,
          maxTokens: 900,
          messages: [
            {
              role: "system",
              content:
                "You are the data assistant inside the Jakarta Coal Exchange admin panel. Answer ONLY from the FACTS JSON. If the answer is not in the facts, say exactly: \"That isn't in the data I have.\" Quote numbers exactly as given, with $ and /t for prices. Keep answers under 120 words; use short bullet points for lists. When you calculate something (a difference or a %), say it is calculated. No forecasts, no trading advice, no causes the facts don't state.\n\nFACTS:\n" +
                JSON.stringify(facts),
            },
            ...prior,
            { role: "user", content: question },
          ],
        });
        let r = await gen.next();
        while (!r.done) {
          text += r.value;
          controller.enqueue(encoder.encode(r.value));
          r = await gen.next();
        }
        model = r.value.model;
      } catch (e) {
        error = e instanceof Error ? e.message : "The AI request failed.";
      }
      const grounding = groundText(text, facts, { derived: true });
      if (!error && text.trim()) await saveAnswer(key, { text, model });
      controller.enqueue(encoder.encode("\u0000" + JSON.stringify({ model, ms: Date.now() - t0, grounding, error, saved: false })));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
