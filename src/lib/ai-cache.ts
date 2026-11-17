import "server-only";
import { createHash } from "crypto";
import { MODELS } from "./nvidia";
import { getSavedAnswer, saveAnswer } from "./store";

/**
 * Saved AI answers. The key is a hash of everything that can change an answer:
 * the task, its input data, the model IDs and the prompt version. So:
 *  - asking the same thing about the same data returns the saved answer (no fluctuation),
 *  - any change to the data, the prompts or the models produces a fresh answer automatically.
 *
 * Bump PROMPT_VERSION whenever a prompt in ai.ts or the Ask route changes.
 */
export const PROMPT_VERSION = "2026-11-17.3";

export function answerKey(task: string, input: unknown): string {
  const h = createHash("sha256").update(PROMPT_VERSION).update(JSON.stringify(MODELS)).update(JSON.stringify(input)).digest("hex");
  return `${task}-${h.slice(0, 40)}`;
}

export async function hasSavedAnswer(key: string): Promise<boolean> {
  return (await getSavedAnswer(key)) != null;
}

/**
 * Return the saved answer for `key`, or run `fn`, save its result and return it.
 * `fresh` skips the saved answer (an explicit "give me another version") and replaces it.
 */
export async function remember<T>(key: string, fn: () => Promise<T>, opts: { fresh?: boolean } = {}): Promise<{ value: T; saved: boolean }> {
  if (!opts.fresh) {
    const hit = await getSavedAnswer<T>(key);
    if (hit != null) return { value: hit, saved: true };
  }
  const value = await fn();
  await saveAnswer(key, value);
  return { value, saved: false };
}
