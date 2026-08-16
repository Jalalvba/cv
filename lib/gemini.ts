import { errorMessage } from "@/lib/api-errors";
import type { GeminiUsageMetadata } from "@/lib/gemini-cost-tracker";
import { DEFAULT_TIER, TIER_ORDER, type ModelTier } from "@/lib/geminiModels";
import { getActiveGeminiModel } from "@/lib/getDynamicModel";

/**
 * Minimal server-only Gemini client — the live replacement for the previous
 * manual loop (download the context prompt from /admin/positionings, paste it
 * into a chat UI with a job offer, copy the JSON back into the paste box).
 *
 * The prompt itself is NOT duplicated here: callers pass the exact markdown
 * produced by lib/context-prompt.ts's buildContextPromptMarkdown(), so the
 * downloadable file and the live call can never drift apart.
 *
 * Never import this from a client component — it reads GEMINI_API_KEY, which
 * must stay server-side.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Resolves the model id this app's constrained-generation tasks (pick
 * existing bullet ids, rewrite a title/summary/skill list) should use by
 * default — the lite tier is the right default, since the schema plus the
 * post-validation in generate-positioning/route.ts catch a weaker model's
 * mistakes rather than letting them reach MongoDB.
 *
 * Resolved live via getActiveGeminiModel() rather than a hardcoded constant,
 * so a new model release doesn't require a code change here.
 */
export function getDefaultModel(): Promise<string> {
  return getActiveGeminiModel(DEFAULT_TIER);
}

/**
 * Structured-JSON settings. Low (not zero) temperature: the output is a
 * schema-constrained document whose bullet ids must match the profile
 * exactly, so there is nothing to gain from sampling diversity — but the
 * summary/targetTitle are prose and go flat at 0.
 *
 * maxOutputTokens is deliberately generous: one response is a full FR *and*
 * EN document, each with a paragraph-length summary and a ~9-item skill
 * list. A truncated response is invalid JSON, which is a far worse failure
 * than a few unused tokens.
 */
const TEMPERATURE = 0.25;
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Thrown for every Gemini failure. `status` is the status this app should
 * return to its own caller (not necessarily Gemini's) and `message` is
 * already safe to show a user — the raw upstream body is never propagated,
 * since Google's error payloads can echo back request content and, on some
 * auth failures, the key itself.
 */
export class GeminiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Checked per-call rather than at module load (unlike lib/db.ts's
    // MONGODB_URI) so that a missing key degrades to one broken admin
    // feature instead of failing the whole build/boot.
    throw new GeminiError(
      "Gemini is not configured on this server (missing GEMINI_API_KEY). See .env.example.",
      500,
    );
  }
  return key;
}

/** The JSON Schema subset Gemini accepts for responseSchema. */
export type ResponseSchema = Record<string, unknown>;

export interface GenerateJsonResult {
  /** The parsed JSON body. Shape validation is the caller's job. */
  json: unknown;
  /** Raw token accounting, passed to the cost tracker. Absent on some responses. */
  usage: GeminiUsageMetadata | undefined;
  /**
   * The concrete model that actually served the request (e.g.
   * "gemini-2.5-flash-lite"). This is how a rolling alias becomes priceable —
   * see lib/gemini-cost-tracker.ts.
   */
  modelVersion: string | undefined;
}

/**
 * Calls generateContent with JSON mode on, and returns the parsed JSON plus
 * the response's token accounting. JSON mode guarantees parseable JSON, never
 * that the content is correct.
 *
 * INTERNAL TRANSPORT — routes must not call this directly. Every action goes
 * through callGeminiWithTracking() in lib/gemini-cost-tracker.ts, so a call
 * can never skip the quota count, usage history and credit accounting.
 */
export async function generateJson(opts: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: ResponseSchema;
  /** Concrete model id or rolling alias. Defaults to the live-discovered default tier. */
  model?: string;
}): Promise<GenerateJsonResult> {
  const apiKey = requireApiKey();
  const model = opts.model ?? (await getDefaultModel());
  if (!isWellFormedModelId(model)) {
    // model is interpolated straight into the request URL below. Ids are
    // discovered live rather than checked against a fixed allowlist (that
    // was the whole thing being fixed here), so validation is a charset/shape
    // check instead: reject anything that isn't a plain "gemini-..." token
    // before it can become part of the request path.
    throw new GeminiError(`Malformed Gemini model id "${model}".`, 500);
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseSchema: opts.responseSchema,
        },
      }),
    });
  } catch (err) {
    // Network-level failure (DNS, TLS, socket). errorMessage() here is the
    // fetch error, which never contains the key or the request body.
    throw new GeminiError(`Could not reach the Gemini API: ${errorMessage(err)}`, 502);
  }

  if (!response.ok) {
    // The upstream body is read only to drain the socket, and is deliberately
    // dropped rather than surfaced or logged — see GeminiError's note.
    await response.text().catch(() => "");
    if (response.status === 429) {
      throw new GeminiError("Gemini rate limit reached. Wait a moment and try again.", 429);
    }
    if (response.status >= 500) {
      throw new GeminiError("Gemini is temporarily unavailable. Try again shortly.", 502);
    }
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError("Gemini rejected this server's API key. Check GEMINI_API_KEY.", 500);
    }
    throw new GeminiError(`Gemini rejected the request (HTTP ${response.status}).`, 502);
  }

  let payload: GeminiResponse;
  try {
    payload = (await response.json()) as GeminiResponse;
  } catch {
    throw new GeminiError("Gemini returned a response that was not JSON.", 502);
  }

  const candidate = payload.candidates?.[0];
  // MAX_TOKENS means the JSON was cut mid-document; say so specifically,
  // since the fix (a shorter job offer, or a larger cap) differs from the
  // generic parse failure below.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new GeminiError(
      "Gemini's response was cut off before it finished (output token limit). Try a shorter job offer.",
      502,
    );
  }
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new GeminiError(`Gemini stopped early (${candidate.finishReason}) without returning a result.`, 502);
  }

  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new GeminiError("Gemini returned an empty response.", 502);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new GeminiError("Gemini returned malformed JSON despite JSON mode being enabled.", 502);
  }

  return { json, usage: payload.usageMetadata, modelVersion: payload.modelVersion };
}

/**
 * Shape check only — NOT a fixed registry, since model ids now come from
 * live discovery (lib/getDynamicModel.ts) and are expected to change without
 * a code change here. Matches both concrete ids ("gemini-2.5-flash-lite")
 * and rolling aliases ("gemini-flash-lite-latest"): lowercase letters,
 * digits, dots and hyphens only, so nothing in this string can break out of
 * the URL path segment it's interpolated into.
 */
const MODEL_ID_PATTERN = /^gemini-[a-z0-9][a-z0-9.-]*$/;

function isWellFormedModelId(model: string): boolean {
  return MODEL_ID_PATTERN.test(model);
}

/** Whether a failure is worth retrying against a pricier tier, vs. one the next tier would hit too. */
function isRetryableAcrossTiers(err: unknown): boolean {
  if (!(err instanceof GeminiError)) return false;
  // 429 (this model's quota) and 5xx/network (502) are model-specific — a
  // different tier is a genuinely different backend and may succeed. 4xx
  // request-shape errors (400, 401/403, malformed/empty response) would
  // reproduce identically on any model, so retrying wastes a call.
  return err.status === 429 || err.status === 502;
}

/**
 * generateJson with automatic step-down-tier fallback: starts at `startTier`
 * (default "flash-lite") and, on a retryable failure (quota/5xx/network),
 * retries once against the next tier up in TIER_ORDER before giving up.
 * Every attempt still flows through generateJson, so each one is priced and
 * validated identically — only the model id changes between attempts.
 */
export async function generateJsonWithFallback(opts: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: ResponseSchema;
  startTier?: ModelTier;
}): Promise<GenerateJsonResult & { model: string }> {
  const startIndex = Math.max(0, TIER_ORDER.indexOf(opts.startTier ?? DEFAULT_TIER));
  const tiersToTry = TIER_ORDER.slice(startIndex);

  let lastError: unknown;
  for (let i = 0; i < tiersToTry.length; i++) {
    const tier = tiersToTry[i];
    // Resolved live per attempt (not read from a hardcoded list) so a tier
    // whose whole lineup changed since the last deploy still resolves.
    const modelId = await getActiveGeminiModel(tier);
    try {
      const result = await generateJson({
        systemInstruction: opts.systemInstruction,
        userPrompt: opts.userPrompt,
        responseSchema: opts.responseSchema,
        model: modelId,
      });
      return { ...result, model: modelId };
    } catch (err) {
      lastError = err;
      const hasMoreTiers = i < tiersToTry.length - 1;
      if (!hasMoreTiers || !isRetryableAcrossTiers(err)) throw err;
      // else: fall through and retry against the next (pricier) tier
    }
  }
  // Unreachable when TIER_ORDER is non-empty, but keeps the return type honest.
  throw lastError instanceof Error ? lastError : new GeminiError("Gemini generation failed.", 502);
}

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
  usageMetadata?: GeminiUsageMetadata;
  /** Concrete model that served the request — present even when a rolling alias was requested. */
  modelVersion?: string;
}
