import type { ModelTier } from "@/lib/geminiModels";

export type { ModelTier };

interface GeminiApiRawModel {
  name: string; // "models/gemini-2.5-flash-lite"
  version?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

const MODELS_LIST_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Substrings that mark a model as NOT a general-purpose text-generation
 * candidate for this app (image/vision/audio/embedding-only endpoints,
 * live/realtime session models, TTS, robotics). Kept as substrings rather
 * than exact ids since Google's naming for these varies by model family.
 */
const SPECIALIZED_MARKERS = [
  "image",
  "vision",
  "tts",
  "robotics",
  "embedding",
  "aqa",
  "realtime",
  "live",
  "audio",
  "native-audio",
  "computer-use",
];

/**
 * Markers that push a model to the back of the list within its tier rather
 * than excluding it outright — an experimental/preview build is still a
 * valid fallback if it's the only thing available in a tier, but a stable
 * release should always be preferred when both exist.
 */
const DEPRIORITIZED_MARKERS = ["preview", "exp", "experimental"];

function isSpecialized(name: string): boolean {
  const lower = name.toLowerCase();
  return SPECIALIZED_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Tier classification by explicit substring match, most-specific first.
 * "flash".includes-style matching alone would misclassify "flash-lite" ids
 * as tier "flash" too (flash-lite contains "flash") — checking flash-lite
 * before flash, and requiring flash NOT be flash-lite, avoids that.
 */
function tierOf(id: string): ModelTier | null {
  if (id.includes("flash-lite")) return "flash-lite";
  if (id.includes("pro")) return "pro";
  if (id.includes("flash")) return "flash";
  return null;
}

/**
 * Extracts the dotted version number (e.g. "2.5" from "gemini-2.5-flash")
 * as a numeric tuple so models can be sorted newest-first correctly. A plain
 * string sort breaks the moment a version reaches double digits — e.g.
 * "gemini-2.10-flash" < "gemini-2.9-flash" lexicographically even though
 * 2.10 is the newer release.
 */
function versionOf(id: string): [number, number] {
  const match = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  if (!match) return [0, 0];
  return [Number(match[1]), Number(match[2] ?? 0)];
}

function compareModelsNewestFirst(a: string, b: string): number {
  const aDeprioritized = DEPRIORITIZED_MARKERS.some((m) => a.includes(m));
  const bDeprioritized = DEPRIORITIZED_MARKERS.some((m) => b.includes(m));
  if (aDeprioritized !== bDeprioritized) return aDeprioritized ? 1 : -1;

  const [aMajor, aMinor] = versionOf(a);
  const [bMajor, bMinor] = versionOf(b);
  if (aMajor !== bMajor) return bMajor - aMajor;
  if (aMinor !== bMinor) return bMinor - aMinor;
  return b.length - a.length; // longer id (e.g. a dated suffix) sorts as more specific/newer
}

/**
 * Live lookup for the newest active Gemini model in a given tier. Queries
 * Google's ListModels endpoint, filters out specialized (non-text) and
 * deprecated-looking entries, and returns the newest remaining id for the
 * requested tier — so a new model release (e.g. a hypothetical 3.0 flash)
 * is picked up automatically without a code change.
 *
 * Falls back to the official rolling alias ("gemini-{tier}-latest") on any
 * missing key, network failure, non-2xx response, or empty result set —
 * every caller always gets back *some* usable model id.
 *
 * Cached via Next.js's fetch data cache (24h) since the model list changes
 * on the order of weeks, not per-request.
 */
export async function getActiveGeminiModel(tier: ModelTier = "flash-lite"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallbackAlias = `gemini-${tier}-latest`;

  if (!apiKey) {
    console.warn("[getDynamicModel] GEMINI_API_KEY missing, using fallback alias:", fallbackAlias);
    return fallbackAlias;
  }

  try {
    const response = await fetch(MODELS_LIST_ENDPOINT, {
      headers: { "x-goog-api-key": apiKey },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      console.warn(`[getDynamicModel] API returned ${response.status}, using alias: ${fallbackAlias}`);
      return fallbackAlias;
    }

    const data = (await response.json()) as { models?: GeminiApiRawModel[] };
    const rawModels = data.models ?? [];

    const textModels = rawModels.filter((m) => {
      const supportsText = m.supportedGenerationMethods?.includes("generateContent") ?? false;
      return supportsText && !isSpecialized(m.name);
    });

    const matchingTierModels = textModels
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((id) => tierOf(id) === tier);

    if (matchingTierModels.length === 0) {
      console.warn(`[getDynamicModel] No active models found for tier "${tier}", using alias: ${fallbackAlias}`);
      return fallbackAlias;
    }

    matchingTierModels.sort(compareModelsNewestFirst);
    return matchingTierModels[0] ?? fallbackAlias;
  } catch (error) {
    console.warn("[getDynamicModel] Error during model discovery, using fallback alias:", error);
    return fallbackAlias;
  }
}
