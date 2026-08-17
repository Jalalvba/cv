/**
 * Tier taxonomy for Gemini models used by this app. NOT a registry of
 * concrete model ids — those are resolved live at call time by
 * lib/gemini-model-discovery.ts's getActiveGeminiModel(), since hardcoding ids here
 * is exactly the failure mode that broke every time Google rotated its
 * model lineup. This file only holds the tier ordering and static UI labels
 * that don't need to track a specific release.
 */

export type ModelTier = "flash-lite" | "flash" | "pro";

/** Tier order, cheapest/fastest first — what the step-down fallback in lib/gemini.ts walks. */
export const TIER_ORDER: ModelTier[] = ["flash-lite", "flash", "pro"];

export const DEFAULT_TIER: ModelTier = "flash-lite";

export interface ModelTierMeta {
  tier: ModelTier;
  label: string;
  description: string;
}

/** Static display metadata, for an optional UI tier picker — not model ids. */
export const MODEL_TIERS: ModelTierMeta[] = [
  {
    tier: "flash-lite",
    label: "Flash-Lite",
    description: "Fastest & cheapest, for routine constrained-generation tasks (Default)",
  },
  {
    tier: "flash",
    label: "Flash",
    description: "Balanced speed and general task capability",
  },
  {
    tier: "pro",
    label: "Pro",
    description: "Strongest reasoning, for complex or ambiguous inputs",
  },
];
