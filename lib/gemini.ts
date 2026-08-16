import { errorMessage } from "@/lib/api-errors";

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
 * Rolling alias for the cheapest active tier. This task is constrained
 * generation (pick existing bullet ids, rewrite a title/summary/skill list),
 * not open-ended reasoning, so the lite tier is the right default — the
 * schema plus the post-validation in generate-positioning/route.ts catch a
 * weaker model's mistakes rather than letting them reach MongoDB.
 */
export const GEMINI_MODEL = "gemini-flash-lite-latest";

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

/**
 * Calls generateContent with JSON mode on, and returns the raw parsed JSON.
 * Shape validation is the caller's job — JSON mode guarantees parseable
 * JSON, never that the content is correct.
 */
export async function generateJson(opts: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: ResponseSchema;
}): Promise<unknown> {
  const apiKey = requireApiKey();

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
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

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GeminiError("Gemini returned malformed JSON despite JSON mode being enabled.", 502);
  }
}

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
}
