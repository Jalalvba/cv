import { z } from "zod";

/**
 * zod schemas for every MongoDB document shape and API request body in the
 * app — mirrors the types in lib/cv-data.ts one-to-one so the two can't
 * silently drift.
 */

// Accepts both a bare domain ("chafiqjalal.com") and a full URL
// ("https://chafiqjalal.com") — lenient on purpose, since this is a
// display-only contact field, not something the app makes requests to.
// An empty string is treated the same as "not set", not a validation error.
const WEBSITE_REGEX = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

const websiteSchema = z
  .string()
  .trim()
  .refine((val) => val.length === 0 || WEBSITE_REGEX.test(val), {
    message: 'Website must be a valid URL or domain, e.g. "example.com" or "https://example.com".',
  })
  .optional();

const dateOfBirthSchema = z
  .string()
  .trim()
  .refine((val) => val.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: 'Date of birth must be in "YYYY-MM-DD" format, e.g. "1990-07-05".',
  })
  .optional();

export const profileDocSchema = z.object({
  _id: z.literal("jalal_chafiq"),
  personal: z.object({
    name: z.string().min(1),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    address: z
      .object({
        street: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    dateOfBirth: dateOfBirthSchema,
    website: websiteSchema,
    languages: z.array(z.object({ lang: z.string(), level: z.string() })),
  }),
  education: z.array(
    z.object({
      id: z.string(),
      degree: z.string(),
      school: z.string(),
      endDate: z.string(),
      honors: z.string().optional(),
      description: z.string().optional(),
      descriptionFr: z.string().optional(),
      tags: z.array(z.string()),
    }),
  ),
  experience: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      bullets: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          textFr: z.string().optional(),
          tags: z.array(z.string()),
        }),
      ),
    }),
  ),
});

// Targeted-edit request body for PATCH /api/admin/update-profile — a partial
// view of profileDocSchema's own field shapes, plus id keys used to locate
// the specific array element to update. Requires at least one change.
//
// `personal` and `education` are NOT `.omit()`-ing anything anymore (they
// used to omit `languages`/`tags` respectively) — the field-by-field editor
// on app/admin/edit/[positioningId]/page.tsx needs to write those too, and a
// value present in a partial() patch always means "replace this field's
// entire value," the same semantics every other field here already has
// (e.g. `website`), so no new update semantics were introduced, just two
// more fields wired up to the existing ones. `bulletTags` is a new sibling
// to `bullets` (which only ever wrote `text`/`textFr`) for the same reason.
export const updateProfileRequestSchema = z
  .object({
    personal: profileDocSchema.shape.personal.partial(),
    education: z.array(profileDocSchema.shape.education.element.partial().extend({ id: z.string().min(1) })),
    bullets: z.array(
      z.object({
        experienceId: z.string().min(1),
        bulletId: z.string().min(1),
        text: z.string().min(1),
        // Which bullet field to write; defaults to "text" so existing callers
        // (the un-positioned profile editor) are unaffected. A per-positioning
        // editor viewing an "fr" positioning passes "textFr" instead — see
        // app/edit/[positioningId]/page.tsx.
        field: z.enum(["text", "textFr"]).optional(),
      }),
    ),
    bulletTags: z.array(
      z.object({
        experienceId: z.string().min(1),
        bulletId: z.string().min(1),
        tags: z.array(z.string()),
      }),
    ),
    // Structural add/remove for whole education entries — kept separate from
    // `education` (which patches fields on an EXISTING entry via arrayFilters)
    // rather than turning `education` into a full-array replace, so a patch
    // to one entry's fields still can't accidentally clobber the others.
    // The form editor's Add/Remove entry controls need this: unlike bullets
    // (only ever *selected into* a positioning via bulletSelection, never
    // authored fresh) or languages/bulletSelection (naturally a single
    // full-value field), education entries are identified by id and don't
    // have an existing "container" field to replace wholesale.
    educationAdd: z.array(profileDocSchema.shape.education.element),
    educationRemove: z.array(z.string().min(1)),
  })
  .partial()
  .refine(
    (body) =>
      (body.personal && Object.keys(body.personal).length > 0) ||
      (body.education && body.education.length > 0) ||
      (body.bullets && body.bullets.length > 0) ||
      (body.bulletTags && body.bulletTags.length > 0) ||
      (body.educationAdd && body.educationAdd.length > 0) ||
      (body.educationRemove && body.educationRemove.length > 0),
    { message: "Request must include at least one change." },
  );

export const positioningDocSchema = z.object({
  _id: z.string().min(1),
  roleGroup: z.string().min(1),
  targetTitle: z.string(),
  summary: z.string(),
  skillsOrder: z.array(z.string()),
  bulletSelection: z.record(z.string(), z.array(z.string())),
  format: z.enum(["visual", "ats"]),
  language: z.enum(["en", "fr"]),
  draftTranslation: z.boolean().optional(),
});

// Targeted-edit request body for PATCH /api/admin/update-positioning — updates
// one PositioningDoc by _id. Field types mirror positioningDocSchema's own
// shapes so the two stay in sync. `bulletSelection` (added alongside the
// field-by-field editor's per-role "add bullet from profile" / "remove
// bullet" controls) is a full-object replace, same pattern as
// `skillsOrder` — the caller sends the complete updated map, not a delta.
// Restructuring `format`/`language`/`roleGroup`/`draftTranslation`, or
// renaming `_id`, still isn't supported here — those go through the Seed
// Positioning JSON tool's full-document replace.
export const updatePositioningRequestSchema = z
  .object({
    positioningId: z.string().min(1),
    skillsOrder: positioningDocSchema.shape.skillsOrder.optional(),
    targetTitle: positioningDocSchema.shape.targetTitle.optional(),
    summary: positioningDocSchema.shape.summary.optional(),
    bulletSelection: positioningDocSchema.shape.bulletSelection.optional(),
  })
  .refine(
    (body) =>
      body.skillsOrder !== undefined ||
      body.targetTitle !== undefined ||
      body.summary !== undefined ||
      body.bulletSelection !== undefined,
    { message: "Request must include at least one change." },
  );

// Matches lib/cv-data.ts's CvData — the assembled shape sent to POST /api/export-pdf.
export const cvDataSchema = z.object({
  photoUrl: z.string(),
  name: z.string().min(1, "Name is required"),
  title: z.string(),
  contact: z.object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    address: z.string().optional(),
    age: z.number().optional(),
    website: websiteSchema,
  }),
  summary: z.string(),
  experience: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      id: z.string(),
      degree: z.string(),
      school: z.string(),
      endDate: z.string(),
      honors: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()),
    }),
  ),
  skills: z.array(z.string()),
  languages: z.array(z.object({ lang: z.string(), level: z.string() })),
});
