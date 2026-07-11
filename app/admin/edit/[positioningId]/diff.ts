import { z } from "zod";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";
import { updateProfileRequestSchema, updatePositioningRequestSchema } from "@/lib/validation";

/**
 * Pure diffing logic for the JSON editor's Save button on
 * app/admin/edit/[positioningId]/page.tsx — split out from the page component
 * so it's plain, testable TypeScript with no React/DOM dependency.
 */

export type UpdateProfileBody = z.infer<typeof updateProfileRequestSchema>;
export type UpdatePositioningPatch = Partial<
  Pick<z.infer<typeof updatePositioningRequestSchema>, "skillsOrder" | "targetTitle" | "summary">
>;

const PERSONAL_PATCH_FIELDS = ["name", "email", "phone", "location", "website"] as const;
const EDUCATION_PATCH_FIELDS = ["degree", "school", "endDate", "honors", "description", "descriptionFr"] as const;

/**
 * Diffs the edited ProfileDoc against the last-loaded snapshot and returns
 * only what PATCH /api/admin/update-profile can actually persist (personal
 * minus languages, education minus tags, bullet text/textFr — see
 * lib/validation.ts's updateProfileRequestSchema). Anything else the user
 * changed (languages, tags, experience metadata, added/removed/reordered
 * entries) is reported in `unsupported` instead of silently dropped, since
 * this route was never built to write those fields — the old per-field
 * editor simply never exposed them either, it just did so less visibly.
 */
export function diffProfile(original: ProfileDoc, edited: ProfileDoc): { patch: UpdateProfileBody; unsupported: string[] } {
  const unsupported: string[] = [];
  const patch: UpdateProfileBody = {};

  const personalPatch: NonNullable<UpdateProfileBody["personal"]> = {};
  for (const field of PERSONAL_PATCH_FIELDS) {
    const before = original.personal[field] ?? "";
    const after = edited.personal[field] ?? "";
    if (before !== after) personalPatch[field] = after;
  }
  if (Object.keys(personalPatch).length > 0) patch.personal = personalPatch;
  if (JSON.stringify(original.personal.languages) !== JSON.stringify(edited.personal.languages)) {
    unsupported.push("personal.languages (not editable via Save)");
  }

  const educationPatch: NonNullable<UpdateProfileBody["education"]> = [];
  const originalEduById = new Map(original.education.map((e) => [e.id, e]));
  const editedEduIds = new Set(edited.education.map((e) => e.id));
  for (const edu of edited.education) {
    const before = originalEduById.get(edu.id);
    if (!before) {
      unsupported.push(`education "${edu.id}" (new entries can't be added via Save)`);
      continue;
    }
    const fields: Partial<Record<(typeof EDUCATION_PATCH_FIELDS)[number], string>> = {};
    for (const field of EDUCATION_PATCH_FIELDS) {
      const b = before[field] ?? "";
      const a = edu[field] ?? "";
      if (b !== a) fields[field] = a;
    }
    if (Object.keys(fields).length > 0) educationPatch.push({ id: edu.id, ...fields });
    if (JSON.stringify(before.tags) !== JSON.stringify(edu.tags)) {
      unsupported.push(`education "${edu.id}" tags (not editable via Save)`);
    }
  }
  for (const before of original.education) {
    if (!editedEduIds.has(before.id)) unsupported.push(`education "${before.id}" (removal not supported via Save)`);
  }
  if (educationPatch.length > 0) patch.education = educationPatch;

  const bulletsPatch: NonNullable<UpdateProfileBody["bullets"]> = [];
  const originalExpById = new Map(original.experience.map((e) => [e.id, e]));
  for (const exp of edited.experience) {
    const beforeExp = originalExpById.get(exp.id);
    if (!beforeExp) {
      unsupported.push(`experience "${exp.id}" (new roles can't be added via Save)`);
      continue;
    }
    if (
      exp.title !== beforeExp.title ||
      exp.company !== beforeExp.company ||
      exp.location !== beforeExp.location ||
      exp.startDate !== beforeExp.startDate ||
      exp.endDate !== beforeExp.endDate
    ) {
      unsupported.push(`experience "${exp.id}" title/company/location/dates (not editable via Save)`);
    }

    const beforeBulletsById = new Map(beforeExp.bullets.map((b) => [b.id, b]));
    const editedBulletIds = new Set(exp.bullets.map((b) => b.id));
    for (const bullet of exp.bullets) {
      const beforeBullet = beforeBulletsById.get(bullet.id);
      if (!beforeBullet) {
        unsupported.push(`bullet "${bullet.id}" on "${exp.id}" (new bullets can't be added via Save)`);
        continue;
      }
      if ((bullet.text ?? "") !== (beforeBullet.text ?? "")) {
        bulletsPatch.push({ experienceId: exp.id, bulletId: bullet.id, text: bullet.text, field: "text" });
      }
      if ((bullet.textFr ?? "") !== (beforeBullet.textFr ?? "")) {
        bulletsPatch.push({ experienceId: exp.id, bulletId: bullet.id, text: bullet.textFr ?? "", field: "textFr" });
      }
      if (JSON.stringify(bullet.tags) !== JSON.stringify(beforeBullet.tags)) {
        unsupported.push(`bullet "${bullet.id}" tags on "${exp.id}" (not editable via Save)`);
      }
    }
    for (const beforeBullet of beforeExp.bullets) {
      if (!editedBulletIds.has(beforeBullet.id)) {
        unsupported.push(`bullet "${beforeBullet.id}" on "${exp.id}" (removal not supported via Save)`);
      }
    }
  }
  for (const beforeExp of original.experience) {
    if (!edited.experience.some((e) => e.id === beforeExp.id)) {
      unsupported.push(`experience "${beforeExp.id}" (removal not supported via Save)`);
    }
  }
  if (bulletsPatch.length > 0) patch.bullets = bulletsPatch;

  return { patch, unsupported };
}

/**
 * Same idea as diffProfile, for PATCH /api/admin/update-positioning: only
 * skillsOrder/targetTitle/summary are writable there (see
 * updatePositioningRequestSchema); bulletSelection/format/language/
 * roleGroup/draftTranslation changes are reported as unsupported rather
 * than silently dropped — restructuring those still goes through the Seed
 * Positioning JSON tool's full-document replace.
 */
export function diffPositioning(
  original: PositioningDoc,
  edited: PositioningDoc,
): { patch: UpdatePositioningPatch; unsupported: string[] } {
  const unsupported: string[] = [];
  const patch: UpdatePositioningPatch = {};

  if (JSON.stringify(original.skillsOrder) !== JSON.stringify(edited.skillsOrder)) patch.skillsOrder = edited.skillsOrder;
  if (original.targetTitle !== edited.targetTitle) patch.targetTitle = edited.targetTitle;
  if (original.summary !== edited.summary) patch.summary = edited.summary;

  if (JSON.stringify(original.bulletSelection) !== JSON.stringify(edited.bulletSelection)) {
    unsupported.push("bulletSelection (not editable via Save — use the Seed Positioning JSON tool)");
  }
  if (original.format !== edited.format) unsupported.push("format (not editable via Save)");
  if (original.language !== edited.language) unsupported.push("language (not editable via Save)");
  if (Boolean(original.draftTranslation) !== Boolean(edited.draftTranslation)) {
    unsupported.push("draftTranslation (not editable via Save)");
  }
  if (original.roleGroup !== edited.roleGroup) unsupported.push("roleGroup (not editable via Save)");

  return { patch, unsupported };
}
