/**
 * Canonical types for the whole app: the two MongoDB document shapes
 * (ProfileDoc, PositioningDoc) and the merged shape assemble() produces from
 * them (CvData) for rendering — see lib/assemble.ts and DOCS.md §7.
 */

export interface ProfileDoc {
  _id: "jalal_chafiq";
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string; // display string used on the CV's contact line, e.g. "Casablanca, Morocco" — unrelated to `address` below
    address?: {
      // structured, separate from `location` — for application forms that need broken-out
      // fields. street/postalCode are also folded into the CV's contact line (assemble()'s
      // contact.address); city/country are NOT re-shown there since `location` already covers them.
      street?: string;
      postalCode?: string;
      city?: string;
      country?: string;
    };
    dateOfBirth?: string; // "YYYY-MM-DD" — age is computed from this at assemble() time (lib/assemble.ts), never stored as a static number, so it's never stale
    website?: string;
    languages: { lang: string; level: string }[];
  };
  education: {
    id: string;
    degree: string;
    school: string;
    endDate: string;
    honors?: string;
    description?: string;
    descriptionFr?: string; // French translation of `description`; same optional-with-fallback pattern as bullets' textFr — see lib/assemble.ts
    tags: string[];
  }[];
  experience: {
    id: string; // e.g. "exp_avis"
    title: string;
    company: string;
    location: string;
    startDate: string; // "2025-07"
    endDate: string | null; // null = current
    bullets: {
      id: string; // e.g. "avis_b1"
      text: string;
      textFr?: string; // French translation; falls back to `text` with a console.warn if missing on an "fr" positioning — see lib/assemble.ts
      tags: string[]; // e.g. ["ops", "customer_care", "fleet"]
    }[];
  }[];
}

export interface PositioningDoc {
  _id: string; // "{roleGroup}_{language}", e.g. "after_sales_manager_en", "after_sales_manager_fr"
  roleGroup: string; // shared across language variants of the same role, e.g. "after_sales_manager" for both _en and _fr
  targetTitle: string;
  summary: string;
  skillsOrder: string[];
  bulletSelection: {
    // which bullet ids to surface for that role; omitting a role key currently falls
    // back to including ALL of that role's bullets — there is no way to drop a role
    // entirely from a positioning. See DOCS.md §10 known gaps.
    [experienceId: string]: string[];
  };
  format: "visual" | "ats";
  language: "en" | "fr";
  draftTranslation?: boolean; // true = machine/AI-translated, not yet human-reviewed; absent or false = validated content
}

/**
 * Assembled shape produced by GET /api/cv/[positioningId] (via assemble()) and
 * rendered by both components/CVPreview.tsx (web) and components/CVDocument.tsx
 * (PDF export).
 */
export interface CvData {
  photoUrl: string;
  name: string;
  title: string; // = positioning.targetTitle
  contact: {
    email: string;
    phone: string;
    location: string;
    address?: string; // street + postalCode only, e.g. "Lot 56, Bd Moulay Ismail, Les Roches Noires, 20290" — city/country are omitted since `location` already shows them
    age?: number; // computed from personal.dateOfBirth at assemble() time
    website?: string;
  };
  summary: string; // = positioning.summary
  experience: {
    id: string;
    title: string;
    company: string;
    dates: string;
    bullets: string[]; // resolved text, filtered + ordered per positioning.bulletSelection
  }[];
  // Currently unfiltered — every positioning shows full education. descriptionFr is
  // resolved away here the same way bullets' textFr is: assemble() picks description
  // or descriptionFr per positioning.language and exposes only the resolved field.
  education: Omit<ProfileDoc["education"][number], "descriptionFr">[];
  skills: string[]; // = positioning.skillsOrder
  languages: ProfileDoc["personal"]["languages"];
}
