"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { discardDraftAction, publishAction, saveDraftAction } from "@/app/admin/actions";
import type { Board } from "@/lib/types";

/** Shared draft state for every admin editor: edit locally, save, publish. */
export function useDraft(initial: Board, initiallyDraft: boolean) {
  const router = useRouter();
  const [board, setBoard] = useState<Board>(initial);
  const [dirty, setDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(initiallyDraft);
  const [pending, start] = useTransition();
  const baseline = useRef(JSON.stringify(initial));

  useEffect(() => {
    baseline.current = JSON.stringify(initial);
    setBoard(initial);
    setDirty(false);
    setHasDraft(initiallyDraft);
  }, [initial, initiallyDraft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((fn: (b: Board) => Board) => {
    setBoard((prev) => {
      const next = fn(structuredClone(prev));
      setDirty(JSON.stringify(next) !== baseline.current);
      return next;
    });
  }, []);

  const save = useCallback(
    () =>
      start(async () => {
        const res = await saveDraftAction(board);
        if (!res.ok) return void toast.error(res.error);
        baseline.current = JSON.stringify(board);
        setDirty(false);
        setHasDraft(true);
        toast.success(res.message ?? "Saved");
        router.refresh();
      }),
    [board, router],
  );

  const publish = useCallback(
    () =>
      start(async () => {
        const res = await publishAction(board);
        if (!res.ok) return void toast.error(res.error);
        baseline.current = JSON.stringify(board);
        setDirty(false);
        setHasDraft(false);
        toast.success(res.message ?? "Published");
        router.refresh();
      }),
    [board, router],
  );

  const discard = useCallback(
    () =>
      start(async () => {
        const res = await discardDraftAction();
        if (!res.ok) return void toast.error(res.error);
        toast.success(res.message ?? "Discarded");
        router.refresh();
      }),
    [router],
  );

  return { board, update, setBoard, dirty, hasDraft, pending, save, publish, discard };
}
