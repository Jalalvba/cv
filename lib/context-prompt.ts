import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";
import { POSITIONING_DOC_SHAPE, PROFILE_DOC_SHAPE } from "@/lib/schema-templates";

/**
 * Builds the downloadable "context prompt" .md file for
 * app/admin/positionings/page.tsx's "Download context prompt" button — a
 * single self-contained file a user can paste into an external AI
 * (Claude/Gemini/etc.) alongside a job offer, with zero other context
 * needed, and get back a valid PositioningDoc FR/EN pair.
 *
 * The rules below are this project's standing convention for how
 * positioning JSON gets generated from a job offer (previously only
 * established in conversation with an AI working directly in this repo);
 * this makes the same rules available standalone, for use with any AI.
 */
export const CONTEXT_PROMPT_RULES = [
  "Use EXCLUSIVELY existing bullet ids from the profile provided below — never invent new bullet text.",
  'bulletSelection must be identical between the FR and EN variant of the same roleGroup — same ids, same order (only targetTitle/summary/skillsOrder are translated/adapted).',
  'format: "ats" for corporate/ATS-portal offers (large company, Workday/SuccessFactors-style portal), "visual" for a direct human contact.',
  "Flag any skill gap explicitly (in prose, outside the JSON) rather than inventing supporting experience for it.",
  "Never hide or omit a real experience entry (e.g. AVIS Maroc) to appear more targeted — the CV stays factual; discretion belongs in the outreach message, not the CV content.",
  "Output ONLY the JSON array — a 2-element array containing the FR object then the EN object. No markdown code fences, no explanation text, nothing before or after the array.",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildContextPromptMarkdown(profile: ProfileDoc, examplePair: PositioningDoc[]): string {
  return `# CV Positioning JSON — Context Prompt

Paste this entire file into Claude, Gemini, or another AI, followed by a job offer's text. The AI should respond with valid JSON matching the schema and examples below — nothing else, no prose.

Generated ${todayIso()} from live profile data.

## Schema

### PositioningDoc

\`\`\`ts
${POSITIONING_DOC_SHAPE}
\`\`\`

### ProfileDoc

\`\`\`ts
${PROFILE_DOC_SHAPE}
\`\`\`

## Rules

${CONTEXT_PROMPT_RULES.map((rule) => `- ${rule}`).join("\n")}

## Current profile (live data — use this, not placeholder content)

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

## Example — a real, currently-seeded positioning pair (FR + EN, same roleGroup)

This is exactly the shape and format your response should match — a JSON array of two PositioningDoc objects.

\`\`\`json
${JSON.stringify(examplePair, null, 2)}
\`\`\`
`;
}

export function contextPromptFilename(): string {
  return `cv-context-prompt-${todayIso()}.md`;
}
