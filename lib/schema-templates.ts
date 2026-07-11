/**
 * Annotated, human-and-AI-readable copies of the TypeScript shapes in
 * lib/cv-data.ts — per-field comments explaining meaning/constraints, meant
 * to be pasted into an external AI prompt alongside a real example (fetched
 * live from GET /api/profile and GET /api/admin/positioning/[id] by
 * app/admin/positionings/page.tsx, not hardcoded here, so the example never
 * goes stale) so a user can generate valid ProfileDoc/PositioningDoc JSON
 * externally and paste the result back into this app.
 *
 * These are plain strings, not derived from lib/cv-data.ts at build time —
 * keep them in sync by hand if a field is added/renamed there.
 */

export const POSITIONING_DOC_SHAPE = `// PositioningDoc — one CV variant: a selection and framing of the profile's
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

export const PROFILE_DOC_SHAPE = `// ProfileDoc — the one underlying-facts document (roles, dates, every bullet
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

/** Known-stable example ids, seeded by scripts/seed.ts — used to fetch a real, complete, always-current example. */
export const EXAMPLE_POSITIONING_ID = "after_sales_manager_fr";
export const EXAMPLE_POSITIONING_ID_EN = "after_sales_manager_en";
export const EXAMPLE_POSITIONING_ID_FR = EXAMPLE_POSITIONING_ID;
