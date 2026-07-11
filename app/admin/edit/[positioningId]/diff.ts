import { z } from "zod";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";
import { updateProfileRequestSchema, updatePositioningRequestSchema } from "@/lib/validation";

/**
 * Pure diffing logic for the Save button on
 * app/admin/edit/[positioningId]/page.tsx — split out from the page component
 * so it's plain, testable TypeScript with no React/DOM dependency.
 *
 * Every field on ProfileDoc/PositioningDoc that the form editor exposes is
 * covered here and lands in `patch` (not `unsupported`) — see
 * lib/validation.ts's updateProfileRequestSchema/updatePositioningRequestSchema,
 * which were extended alongside this rebuild specifically so `personal.languages`,
 * education/bullet `tags`, `bulletSelection`, and adding/removing whole
 * education entries stop being silently dropped (the gap the prior
 * JSON-editor session's amber "not saved" panel surfaced, but didn't
 * close). `unsupported` still exists for the fields genuinely out of scope
 * for a targeted PATCH — adding/removing a whole experience (role) entry,
 * a role's title/company/location/dates, adding a brand-new bullet with
 * new text (bullets are only ever *selected into* a positioning via
 * bulletSelection, never authored fresh here), and renaming/restructuring
 * a positioning's `_id`/`roleGroup`/`format`/`language`/`draftTranslation`
 * — those still go through the Seed Positioning JSON tool's full-document
 * replace.
 */

export type UpdateProfileBody = z.infer<typeof updateProfileRequestSchema>;
export type UpdatePositioningPatch = Partial<
  Pick<z.infer<typeof updatePositioningRequestSchema>, "skillsOrder" | "targetTitle" | "summary" | "bulletSelection">
>;

const PERSONAL_PATCH_FIELDS = ["name", "email", "phone", "location", "website"] as const;
const EDUCATION_PATCH_FIELDS = ["degree", "school", "endDate", "honors", "description", "descriptionFr"] as const;

/**
 * Diffs the edited ProfileDoc against the last-loaded snapshot and returns
 * everything PATCH /api/admin/update-profile can persist. `unsupported`
 * covers only structural adds/removes (new/removed education or experience
 * entries, new/removed bullets, experience metadata like title/company/
 * dates) — there's no "add a new bullet" or "add an experience entry"
 * control in the form editor, so those can only happen via a raw edit to
 * the loaded data shape, which shouldn't occur through normal form use.
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
  if (JSON.stringify(original.personal.languages) !== JSON.stringify(edited.personal.languages)) {
    personalPatch.languages = edited.personal.languages;
  }
  if (JSON.stringify(original.personal.address ?? {}) !== JSON.stringify(edited.personal.address ?? {})) {
    personalPatch.address = edited.personal.address;
  }
  if (Object.keys(personalPatch).length > 0) patch.personal = personalPatch;

  const educationPatch: NonNullable<UpdateProfileBody["education"]> = [];
  const educationAddPatch: NonNullable<UpdateProfileBody["educationAdd"]> = [];
  const originalEduById = new Map(original.education.map((e) => [e.id, e]));
  const editedEduIds = new Set(edited.education.map((e) => e.id));
  for (const edu of edited.education) {
    const before = originalEduById.get(edu.id);
    if (!before) {
      educationAddPatch.push(edu);
      continue;
    }
    const fields: Partial<Record<(typeof EDUCATION_PATCH_FIELDS)[number], string>> & { tags?: string[] } = {};
    for (const field of EDUCATION_PATCH_FIELDS) {
      const b = before[field] ?? "";
      const a = edu[field] ?? "";
      if (b !== a) fields[field] = a;
    }
    if (JSON.stringify(before.tags) !== JSON.stringify(edu.tags)) {
      fields.tags = edu.tags;
    }
    if (Object.keys(fields).length > 0) educationPatch.push({ id: edu.id, ...fields });
  }
  const educationRemovePatch: NonNullable<UpdateProfileBody["educationRemove"]> = [];
  for (const before of original.education) {
    if (!editedEduIds.has(before.id)) educationRemovePatch.push(before.id);
  }
  if (educationPatch.length > 0) patch.education = educationPatch;
  if (educationAddPatch.length > 0) patch.educationAdd = educationAddPatch;
  if (educationRemovePatch.length > 0) patch.educationRemove = educationRemovePatch;

  const bulletsPatch: NonNullable<UpdateProfileBody["bullets"]> = [];
  const bulletTagsPatch: NonNullable<UpdateProfileBody["bulletTags"]> = [];
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
        bulletTagsPatch.push({ experienceId: exp.id, bulletId: bullet.id, tags: bullet.tags });
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
  if (bulletTagsPatch.length > 0) patch.bulletTags = bulletTagsPatch;

  return { patch, unsupported };
}

/**
 * Same idea as diffProfile, for PATCH /api/admin/update-positioning:
 * skillsOrder/targetTitle/summary/bulletSelection are all writable there
 * (see updatePositioningRequestSchema). format/language/roleGroup/
 * draftTranslation and renaming `_id` are still reported as unsupported —
 * restructuring those still goes through the Seed Positioning JSON tool's
 * full-document replace.
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
    patch.bulletSelection = edited.bulletSelection;
  }

  if (original.format !== edited.format) unsupported.push("format (not editable via Save)");
  if (original.language !== edited.language) unsupported.push("language (not editable via Save)");
  if (Boolean(original.draftTranslation) !== Boolean(edited.draftTranslation)) {
    unsupported.push("draftTranslation (not editable via Save)");
  }
  if (original.roleGroup !== edited.roleGroup) unsupported.push("roleGroup (not editable via Save)");

  return { patch, unsupported };
}
