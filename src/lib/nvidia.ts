import "server-only";

/**
 * Minimal client for NVIDIA's hosted API (OpenAI-compatible).
 * https://integrate.api.nvidia.com/v1/chat/completions
 *
 * Model IDs are configurable; defaults were checked against NVIDIA's live
 * model list (GET /v1/models) on 2026-11-17.
 */

const BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

export const MODELS = {
  /** Strongest reasoning — summaries, analysis, the market brief. */
  reasoning: process.env.NVIDIA_MODEL_REASONING || "nvidia/nemotron-3-ultra-550b-a55b",
  /** Vision-language — reads price-board images and scanned documents. */
  vision: process.env.NVIDIA_MODEL_VISION || "nvidia/nemotron-3.5-super-vl-120b-a12b",
  /** Fast — extraction from text and quick tasks. */
  fast: process.env.NVIDIA_MODEL_FAST || "nvidia/nemotron-3.5-lightning-30b-a3b",
};

/** If a model is unavailable, try the next one in the chain. */
const FALLBACK: Record<string, string[]> = {
  [MODELS.reasoning]: [MODELS.vision, MODELS.fast],
  [MODELS.vision]: [],
  [MODELS.fast]: [MODELS.vision],
};

export function nvidiaEnabled() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type Message = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export class AiError extends Error {}

type ChatOpts = {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  /** Turn the model's reasoning mode on (better accuracy, slower) or off. */
  thinking?: boolean;
  timeoutMs?: number;
};

async function call(opts: ChatOpts, withTemplateKwargs: boolean): Promise<{ text: string; model: string; ms: number }> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new AiError("NVIDIA_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    top_p: 0.95,
    max_tokens: opts.maxTokens ?? 8192,
    stream: false,
  };
  if (withTemplateKwargs && opts.thinking !== undefined) body.chat_template_kwargs = { enable_thinking: opts.thinking };
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const err = new AiError(`NVIDIA API ${res.status}: ${detail || res.statusText}`);
    (err as AiError & { status?: number }).status = res.status;
    throw err;
  }
  const j = (await res.json()) as { model?: string; choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
  const choice = j.choices?.[0];
  let text = choice?.message?.content ?? "";
  // Some models inline their reasoning; keep only the answer.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
  if (!text && choice?.finish_reason === "length") throw new AiError("The model ran out of tokens before answering. Try a smaller file.");
  if (!text) throw new AiError("The model returned an empty answer.");
  return { text, model: j.model || opts.model, ms: Date.now() - t0 };
}

export async function chat(opts: ChatOpts): Promise<{ text: string; model: string; ms: number }> {
  const chain = [opts.model, ...(FALLBACK[opts.model] ?? [])];
  let last: unknown;
  for (const model of chain) {
    for (const kwargs of [true, false]) {
      try {
        return await call({ ...opts, model }, kwargs);
      } catch (e) {
        last = e;
        const status = (e as { status?: number }).status;
        if (status === 400 || status === 422) continue; // retry once without chat_template_kwargs
        if (status === 401 || status === 403) throw new AiError("NVIDIA rejected the API key. Check NVIDIA_API_KEY.");
        if (status === 429) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        break; // 404 / 5xx / timeout → next model in the chain
      }
    }
  }
  throw last instanceof Error ? last : new AiError("The AI request failed.");
}

/** Pull the first JSON object out of a model answer (handles ```json fences and stray prose). */
export function parseJson<T = unknown>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const src = fenced ?? text;
  const start = src.indexOf("{");
  if (start < 0) throw new AiError("The model did not return JSON.");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(src.slice(start, i + 1)) as T;
  }
  throw new AiError("The model's JSON was incomplete.");
}

/** chat() + JSON parsing + schema validation, with one corrective retry. */
export async function chatJson<T>(opts: ChatOpts, validate: (v: unknown) => T): Promise<{ data: T; model: string; ms: number }> {
  let messages = opts.messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({ ...opts, messages });
    try {
      return { data: validate(parseJson(r.text)), model: r.model, ms: r.ms };
    } catch (e) {
      if (attempt === 1) throw e instanceof AiError ? e : new AiError("The AI answer did not match the expected format.");
      messages = [...messages, { role: "assistant", content: r.text.slice(0, 4000) }, { role: "user", content: "That was not valid JSON for the schema. Reply with ONLY the JSON object, nothing else." }];
    }
  }
  throw new AiError("The AI answer did not match the expected format.");
}
