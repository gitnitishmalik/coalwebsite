"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudUpload, LoaderCircle, Rocket, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Check } from "@/lib/types";
import { checkCounts } from "@/lib/checks";

export function DraftBar({
  dirty,
  hasDraft,
  pending,
  checks,
  onSave,
  onPublish,
  onDiscard,
}: {
  dirty: boolean;
  hasDraft: boolean;
  pending: boolean;
  checks: Check[];
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const c = checkCounts(checks);
  const state = dirty ? "Unsaved changes" : hasDraft ? "Draft saved — not published yet" : "Up to date with the live site";

  return (
    <>
      <div className="sticky bottom-0 z-30 mt-8 border-t bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <span className="flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${dirty ? "bg-warning" : hasDraft ? "bg-info" : "bg-good"}`} />
            <span className="font-medium">{state}</span>
            {(c.critical > 0 || c.warning > 0) && (
              <span className="text-muted-foreground">
                · {c.critical} critical, {c.warning} warnings
              </span>
            )}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {hasDraft && !dirty && (
              <Button variant="ghost" size="lg" onClick={onDiscard} disabled={pending}>
                <Undo2 /> Discard draft
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={onSave} disabled={pending || !dirty}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Save />} Save draft
            </Button>
            <Button size="lg" onClick={() => setConfirm(true)} disabled={pending || (!dirty && !hasDraft)}>
              <Rocket /> Publish
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to the live site?</DialogTitle>
            <DialogDescription>
              Everyone visiting Jakarta Coal Exchange will see these numbers within a minute. The previous version stays in the history.
            </DialogDescription>
          </DialogHeader>
          <AnimatePresence>
            {(c.critical > 0 || c.warning > 0) && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">
                The checks found <b>{c.critical} critical</b> and <b>{c.warning} warning</b> issue{c.critical + c.warning === 1 ? "" : "s"}. You can still publish — they will be listed on the
                public Insights page.
              </motion.p>
            )}
          </AnimatePresence>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                setConfirm(false);
                onPublish();
              }}
            >
              <CloudUpload /> Publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
