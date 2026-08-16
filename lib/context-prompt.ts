import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";

/**
 * Single source for the downloadable "context prompt" .md file built by
 * app/admin/positionings/page.tsx's "Download context prompt" button — a
 * self-contained file a user can paste into an external AI (Claude/Gemini/
 * etc.) alongside a job offer, with zero other context needed, and get back
 * a valid PositioningDoc FR/EN pair.
 *
 * Everything the file needs — the annotated shapes, the live examples, and
 * the standing generation rules — is assembled by the one function below
 * (buildContextPromptMarkdown), in the order a reader actually needs it:
 * PositioningDoc shape → PositioningDoc example → ProfileDoc shape →
 * ProfileDoc example → rules. There is no separate on-page rendering of
 * this content; the .md file is the only place it's shown.
 */

const POSITIONING_DOC_SHAPE = `// PositioningDoc — one CV variant: a selection and framing of the profile's
// underlying facts, not a copy of the text itself. See DOCS.md §7.2.

interface PositioningDoc {
  _id: string;                 // unique id — convention: "{roleGroup}_{language}", e.g. "after_sales_manager_en"
  roleGroup: string;           // shared by the FR/EN pair of the same role — the role picker groups positionings by this
  targetTitle: string;         // headline shown under the name on the CV
  summary: string;             // professional summary paragraph, specific to this positioning
  skillsOrder: string[];       // flat list of skill strings, rendered "•"-joined in this exact order
  bulletSelection: {
    [experienceId: string]: string[];
    // keys are experience ids from ProfileDoc.experience[].id (e.g. "exp_avis")
    // values are bullet ids from that experience's bullets[].id, in the order they should appear on the CV
    // omitting a role key currently falls back to including ALL of that role's bullets —
    // there is no way to drop a role entirely from a positioning (see DOCS.md §10 known gaps)
  };
  format: "visual" | "ats";    // "visual" = photo/navy/amber design; "ats" = single-column plain layout
  language: "en" | "fr";       // must be exactly "en" or "fr" — selects text vs. textFr / description vs. descriptionFr when assembled
  draftTranslation?: boolean;  // optional; true = machine-translated and not yet human-reviewed; omit or set false once reviewed
}`;

const PROFILE_DOC_SHAPE = `// ProfileDoc — the one underlying-facts document (roles, dates, every bullet
// ever written, education, skills, personal info). Every positioning selects
// and frames a subset of this same document; it is never duplicated per
// positioning. See DOCS.md §7.1.

interface ProfileDoc {
  _id: "jalal_chafiq";           // fixed literal — there is exactly one profile document, this is its id
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    website?: string;            // optional; bare domain or full URL, e.g. "chafiqjalal.com" or "https://chafiqjalal.com"
    languages: { lang: string; level: string }[];
  };
  education: {
    id: string;                  // stable id, must be unique across all education entries
    degree: string;
    school: string;
    endDate: string;
    honors?: string;             // optional, e.g. "Highest Honors"
    description?: string;        // optional, English
    descriptionFr?: string;      // optional French translation of description — falls back to description (with a console.warn) if missing on an "fr" positioning
    tags: string[];
  }[];
  experience: {
    id: string;                  // stable id, e.g. "exp_avis" — referenced by PositioningDoc.bulletSelection's keys
    title: string;
    company: string;
    location: string;
    startDate: string;           // "YYYY-MM", e.g. "2025-07"
    endDate: string | null;      // null = current role, rendered as "Present"
    bullets: {
      id: string;                // stable id, e.g. "avis_b1" — referenced by PositioningDoc.bulletSelection's values
      text: string;               // English bullet text
      textFr?: string;            // optional French translation — falls back to text (with a console.warn) if missing on an "fr" positioning
      tags: string[];             // free-form categorization tags, e.g. ["ops", "customer_care", "fleet"]
    }[];
  }[];
}`;

/** Known-stable example ids, seeded by scripts/seed.ts — used to fetch a real, complete, always-current example pair. */
export const EXAMPLE_POSITIONING_ID = "after_sales_manager_fr";
export const EXAMPLE_POSITIONING_ID_EN = "after_sales_manager_en";

export const CONTEXT_PROMPT_RULES = [
  "Use EXCLUSIVELY existing bullet ids from the profile provided below — never invent new bullet text.",
  "SELECT, do not dump: choose only the 3-5 MOST RELEVANT bullets per role for this specific job offer. Never include every bullet a role has. A positioning is a targeted selection, not the full profile — including everything is a failure, not a safe default.",
  "Rank each role's bullets against the offer's key requirements and keep the top 3-5: a bullet that directly matches a stated requirement (a named responsibility, tool, standard, metric, or scope in the offer) always beats a general or generic-strength bullet. If a role has more than 5 bullets that match, keep the 5 strongest and drop the rest.",
  "Give EVERY experience id its own explicit bulletSelection key with its 3-5 chosen ids — including older/less relevant roles, which still get their 3 best. Do not omit a role's key: an omitted key silently falls back to including ALL of that role's bullets, which is exactly what this rule forbids.",
  'bulletSelection must be identical between the FR and EN variant of the same roleGroup — same ids, same order (only targetTitle/summary/skillsOrder are translated/adapted).',
  'format: "ats" for corporate/ATS-portal offers (large company, Workday/SuccessFactors-style portal), "visual" for a direct human contact.',
  "Flag any skill gap explicitly (in prose, outside the JSON) rather than inventing supporting experience for it.",
  "Never hide or omit a real experience entry (e.g. AVIS Maroc) to appear more targeted — the CV stays factual; discretion belongs in the outreach message, not the CV content.",
  "Output ONLY the JSON array — a 2-element array containing the FR object then the EN object. No markdown code fences, no explanation text, nothing before or after the array.",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds the entire context-prompt document as one coherent block, in the
 * order a reader needs it: instructions, PositioningDoc shape + example,
 * ProfileDoc shape + example, then the generation rules.
 */
export function buildContextPromptMarkdown(profile: ProfileDoc, examplePair: PositioningDoc[]): string {
  return `# CV Positioning JSON — Context Prompt

Paste this entire file into Claude, Gemini, or another AI, followed by a job offer's text. The AI should respond with valid JSON matching the schema and examples below — nothing else, no prose.

Generated ${todayIso()} from live profile data.

## PositioningDoc — shape

\`\`\`ts
${POSITIONING_DOC_SHAPE}
\`\`\`

## PositioningDoc — example (live, a real FR + EN pair)

This is exactly the shape and format your response should match — a JSON array of two PositioningDoc objects.

\`\`\`json
${JSON.stringify(examplePair, null, 2)}
\`\`\`

## ProfileDoc — shape

\`\`\`ts
${PROFILE_DOC_SHAPE}
\`\`\`

## ProfileDoc — example (live, the full current profile — use this, not placeholder content)

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

## Rules

${CONTEXT_PROMPT_RULES.map((rule) => `- ${rule}`).join("\n")}
`;
}
