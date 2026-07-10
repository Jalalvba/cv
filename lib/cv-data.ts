export interface ProfileDoc {
  _id: "jalal_chafiq";
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
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
    [experienceId: string]: string[]; // which bullet ids to surface for that role; omit a role entirely to drop it from this CV
  };
  format: "visual" | "ats";
  language: "en" | "fr";
  draftTranslation?: boolean; // true = machine/AI-translated, not yet human-reviewed; absent or false = validated content
}

/**
 * Assembled shape rendered by CVDocument for PDF export — see lib/assemble.ts.
 * Produced by GET /api/cv/[positioningId]; not currently consumed by any page
 * in app/ (the main page now edits ProfileDoc directly, unpositioned) but the
 * route and this shape stay in place for future positioning-based UI.
 */
export interface CvData {
  photoUrl: string;
  name: string;
  title: string; // = positioning.targetTitle
  contact: { email: string; phone: string; location: string; website?: string };
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
