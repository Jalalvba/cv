/**
 * Small presentation/parsing helpers shared by every section of the admin
 * editor form. Kept in one module so the sections all render identical
 * inputs and parse tags the same way — a section that reimplemented either
 * would drift visually or, worse, store tags in a different shape.
 */

/** The one input/textarea/select styling used by every field in the editor form. */
export const INPUT_CLASS = "rounded border border-neutral-300 px-3 py-2 text-xs";

/** Renders a tag array for editing as a single comma-separated text input. */
export function tagsToText(tags: string[]): string {
  return tags.join(", ");
}

/**
 * Parses the comma-separated tag input back into an array.
 *
 * Empty segments are dropped so that a trailing comma or a double comma
 * (both unavoidable while typing) doesn't persist an empty-string tag.
 *
 * @param text Raw input value, e.g. "ops, fleet, ".
 * @returns The trimmed, non-empty tags, e.g. ["ops", "fleet"].
 */
export function textToTags(text: string): string[] {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Generates a client-side id for a newly added entry (currently only
 * education entries, which the form can create; bullets and experiences are
 * never authored here).
 *
 * The id must be unique across the profile document but is never shown to
 * the user, so a short random suffix is enough. `crypto.randomUUID` isn't
 * available in every browser/context this could run in, hence the
 * timestamp fallback.
 *
 * @param prefix Short kind marker, e.g. "edu".
 */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36);
  return `${prefix}_${random}`;
}
