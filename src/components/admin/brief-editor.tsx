"use client";

import { useMemo, useState, useTransition } from "react";
import { BadgeCheck, LoaderCircle, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { draftBriefAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BriefCard } from "@/components/site/insight-cards";
import { runChecks } from "@/lib/checks";
import { fmtDate } from "@/lib/format";
import type { Board } from "@/lib/types";
import { DraftBar } from "./draft-bar";
import { Panel } from "./page-title";
import { useDraft } from "./use-draft";

export function BriefEditor({ initial, isDraft, aiOn, me }: { initial: Board; isDraft: boolean; aiOn: boolean; me: string }) {
  const d = useDraft(initial, isDraft);
  const { board, update } = d;
  const checks = useMemo(() => runChecks(board), [board]);
  const [busy, start] = useTransition();
  const [deep, setDeep] = useState(false);
  const brief = board.brief;

  // "Generate" always gives the same draft for the same data (saved answer, temperature 0).
  // "Another wording" deliberately asks for a different version of the same facts.
  const generate = (another: boolean) =>
    start(async () => {
      if (brief.paragraphs.length && !confirm("Replace the current brief with a new AI draft?")) return;
      const res = await draftBriefAction(board, deep, another);
      if (!res.ok) return void toast.error(res.error);
      update((b) => {
        b.brief = { paragraphs: res.data!.paragraphs, generatedAt: new Date().toISOString(), model: res.data!.model, reviewedBy: null, reviewedAt: null };
        return b;
      });
      const how = res.data!.saved ? "Same data as before — this is the saved draft." : "New draft written.";
      if (res.data!.unverified.length)
        toast.warning(`${how} Check these figures — they are not in the data: ${res.data!.unverified.join(", ")}. Publishing will stop until they are fixed or confirmed.`, { duration: 15000 });
      else toast.success(`${how} Every figure traced to the data. Read it, then mark it reviewed.`);
    });

  const edit = (fn: (p: string[]) => void) =>
    update((b) => {
      fn(b.brief.paragraphs);
      b.brief.reviewedBy = null;
      b.brief.reviewedAt = null;
      return b;
    });

  return (
    <>
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-2">
        <Panel
          className="min-w-0"
          title="Editor"
          sub="AI writes only from the numbers in your draft, and every figure is checked against them. Editing a reviewed brief resets its review."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft" title="Reasoning mode: slower but more thorough">
                <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="size-4 accent-primary" /> Deep
              </label>
              {brief.generatedAt && (
                <Button variant="outline" onClick={() => generate(true)} disabled={busy || !aiOn} title="Same facts, different wording">
                  <RotateCcw /> Another wording
                </Button>
              )}
              <Button onClick={() => generate(false)} disabled={busy || !aiOn}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Generate with AI
              </Button>
            </div>
          }
        >
          {!aiOn && <p className="mb-3 text-sm text-warning">AI is off — add NVIDIA_API_KEY to generate briefs. You can still write one by hand.</p>}
          <div className="space-y-3">
            {brief.paragraphs.map((p, i) => (
              <div key={`${i}-${p.length}`} className="flex gap-2">
                <Textarea defaultValue={p} rows={3} className="text-sm" aria-label={`Paragraph ${i + 1}`} onBlur={(e) => e.target.value !== p && edit((ps) => (ps[i] = e.target.value))} />
                <Button variant="ghost" size="icon" aria-label="Remove paragraph" onClick={() => edit((ps) => ps.splice(i, 1))}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => edit((ps) => ps.push(""))} disabled={brief.paragraphs.length >= 8}>
              <Plus /> Add paragraph
            </Button>
            {brief.reviewedBy ? (
              <Button variant="outline" size="sm" onClick={() => update((b) => ((b.brief.reviewedBy = null), (b.brief.reviewedAt = null), b))}>
                <RotateCcw /> Undo review
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => update((b) => ((b.brief.reviewedBy = me), (b.brief.reviewedAt = new Date().toISOString()), b))}
                disabled={!brief.paragraphs.some((p) => p.trim())}
              >
                <BadgeCheck /> Mark reviewed as {me}
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {brief.generatedAt ? `Last AI draft ${fmtDate(brief.generatedAt)}${brief.model ? ` · ${brief.model}` : ""}.` : "Written by hand."} Save the draft, then publish to show it on the site.
          </p>
        </Panel>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Live preview</p>
          <BriefCard board={board} />
        </div>
      </div>
      <DraftBar dirty={d.dirty} hasDraft={d.hasDraft} pending={d.pending} checks={checks} onSave={d.save} onPublish={d.publish} onDiscard={d.discard} />
    </>
  );
}
