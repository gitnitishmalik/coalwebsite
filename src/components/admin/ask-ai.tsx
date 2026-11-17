"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, BadgeCheck, Calculator, CircleStop, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Meta = { model: string; ms: number; grounding: { checked: number; unverified: string[]; derived?: string[] }; error: string | null };
type Turn = { q: string; a: string; meta: Meta | null; firstMs: number | null; streaming: boolean };

const SUGGESTIONS = [
  "How does SCR#1 compare with the HBA for the same period?",
  "Which 6,000 NAR origin is cheapest and which is dearest?",
  "Summarise the HBA trend since its peak.",
  "Which HBA values still rely on a single source?",
  "What is waiting for my approval?",
];

/** Tiny formatter: **bold**, bullet lines, paragraphs. Text only — no HTML from the model. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong> : <span key={`${k}${i}`}>{p}</span>));
  return (
    <div className="space-y-2">
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return (
            <ul key={bi} className="space-y-1">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${bi}-${li}-`)}</span>
                </li>
              ))}
            </ul>
          );
        return <p key={bi}>{lines.map((l, li) => <span key={li}>{inline(l, `${bi}-${li}-`)}{li < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

function GroundBadge({ meta }: { meta: Meta }) {
  const g = meta.grounding;
  const derived = g.derived ?? [];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
      {g.unverified.length ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-critical" title={g.unverified.join(", ")}>
          <TriangleAlert className="size-3" /> {g.unverified.length} figure{g.unverified.length > 1 ? "s" : ""} not in the data: {g.unverified.join(", ")}
        </span>
      ) : g.checked ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-semibold text-good">
          <BadgeCheck className="size-3" /> {g.checked - derived.length} figure{g.checked - derived.length === 1 ? "" : "s"} traced to the data
        </span>
      ) : null}
      {derived.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-info" title={derived.join(", ")}>
          <Calculator className="size-3" /> {derived.length} calculated from the data
        </span>
      )}
      <span className="text-muted-foreground">
        {meta.model.split("/").pop()} · {(meta.ms / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

export function AskAi({ aiOn, compact = false, autoAsk }: { aiOn: boolean; compact?: boolean; autoAsk?: { q: string; n: number } | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"live" | "draft">("live");
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.streaming);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [turns]);
  const lastAuto = useRef(0);
  useEffect(() => {
    if (autoAsk && autoAsk.n !== lastAuto.current && aiOn) {
      lastAuto.current = autoAsk.n;
      void ask(autoAsk.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    const history = turns.filter((t) => t.meta && !t.meta.error).map((t) => ({ q: t.q, a: t.a }));
    setTurns((ts) => [...ts, { q: text, a: "", meta: null, firstMs: null, streaming: true }]);
    const ctl = new AbortController();
    abort.current = ctl;
    const t0 = performance.now();
    const patch = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? fn(t) : t)));
    try {
      const res = await fetch("/api/admin/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, source, history }), signal: ctl.signal });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Request failed");
        patch((t) => ({ ...t, a: msg, streaming: false, meta: { model: "", ms: 0, grounding: { checked: 0, unverified: [] }, error: msg } }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let raw = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        const [answer] = raw.split("\u0000");
        patch((t) => ({ ...t, a: answer, firstMs: t.firstMs ?? (answer ? performance.now() - t0 : null) }));
      }
      const [answer, trailer] = raw.split("\u0000");
      const meta = trailer ? (JSON.parse(trailer) as Meta) : null;
      patch((t) => ({ ...t, a: meta?.error && !answer ? `Sorry — ${meta.error}` : answer, meta, streaming: false }));
    } catch (e) {
      if ((e as Error).name === "AbortError") patch((t) => ({ ...t, streaming: false, a: t.a + (t.a ? "\n\n" : "") + "(stopped)" }));
      else patch((t) => ({ ...t, streaming: false, a: "Sorry — the request failed." }));
    } finally {
      abort.current = null;
    }
  }

  return (
    <div className={cn("flex flex-col", compact ? "h-full" : "")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Answer from</span>
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium">
          {(["live", "draft"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)} className={cn("relative rounded-md px-2.5 py-1", source === s ? "text-foreground" : "text-muted-foreground")}>
              {source === s && <motion.span layoutId={`ask-src-${compact}`} className="absolute inset-0 rounded-md bg-white shadow-sm" />}
              <span className="relative">{s === "live" ? "Live site" : "My draft"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-4 space-y-5 overflow-y-auto pr-1", compact ? "min-h-0 flex-1" : "max-h-[460px]")}>
        {!turns.length && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!aiOn}
                onClick={() => ask(s)}
                className="rounded-full border bg-white px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-primary/40 hover:bg-accent/40 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm text-background">{t.q}</div>
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
                  {t.a ? <Rich text={t.a} /> : <span className="inline-flex items-center gap-1 text-muted-foreground"><span className="size-1.5 animate-bounce rounded-full bg-primary" /><span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:.15s]" /><span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:.3s]" /></span>}
                  {t.streaming && t.a && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-primary" />}
                  {t.meta && !t.meta.error && <GroundBadge meta={t.meta} />}
                  {t.firstMs != null && !t.streaming && <div className="mt-1 text-[10px] text-muted-foreground">first words in {(t.firstMs / 1000).toFixed(2)}s</div>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-4 flex items-end gap-2 rounded-2xl border bg-white p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(q);
            }
          }}
          rows={1}
          placeholder={aiOn ? "Ask about prices, the HBA, changes, sources…" : "Add NVIDIA_API_KEY to enable"}
          disabled={!aiOn}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          aria-label="Ask the data"
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()} className="grid size-9 place-items-center rounded-xl bg-muted text-foreground" aria-label="Stop">
            <CircleStop className="size-4" />
          </button>
        ) : (
          <button type="submit" disabled={!aiOn || !q.trim()} className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send">
            <ArrowUp className="size-4" />
          </button>
        )}
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">Answers use only your data. Every figure is checked: traced, calculated, or flagged.</p>
    </div>
  );
}
