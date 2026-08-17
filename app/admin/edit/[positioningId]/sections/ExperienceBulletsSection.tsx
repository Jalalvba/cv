"use client";

import type { ProfileDoc } from "@/lib/cv-data";
import type { BulletEntry, ExperienceEntry } from "../usePositioningEditor";
import { INPUT_CLASS, tagsToText } from "../fields";

/**
 * Per-role bullet editing — the one section that writes to BOTH documents.
 *
 * Editing a bullet's wording changes the profile (and therefore every
 * positioning that surfaces that bullet). Adding or removing a bullet here
 * changes only this positioning's `bulletSelection` — the bullet text itself
 * is never created or deleted, just selected in or out. Keeping that
 * distinction visible is why "Remove" sits next to a bullet but the add
 * control is a dropdown of bullets that already exist on the profile.
 *
 * The maximum characters of a bullet's English text shown in that dropdown
 * before truncating — long enough to tell two bullets apart, short enough
 * that the options stay one line each.
 */
const BULLET_OPTION_PREVIEW_LENGTH = 70;

export function ExperienceBulletsSection({
  experience,
  bulletField,
  selectedBulletIds,
  onBulletChange,
  onBulletTagsChange,
  onAddBullet,
  onRemoveBullet,
}: {
  experience: ProfileDoc["experience"];
  /**
   * Which bullet field this positioning edits — "textFr" for an "fr"
   * positioning, "text" otherwise. Passed in so the section doesn't need the
   * positioning document itself.
   */
  bulletField: "text" | "textFr";
  /** Returns the bullet ids this positioning surfaces for a role, in order. */
  selectedBulletIds: (exp: ExperienceEntry) => string[];
  onBulletChange: (experienceId: string, bulletId: string, value: string) => void;
  onBulletTagsChange: (experienceId: string, bulletId: string, text: string) => void;
  onAddBullet: (exp: ExperienceEntry, bulletId: string) => void;
  onRemoveBullet: (exp: ExperienceEntry, bulletId: string) => void;
}) {
  return (
    <section className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="text-sm font-semibold text-cv-navy">
        Experience bullets ({bulletField === "textFr" ? "editing textFr" : "editing text"})
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        {experience.map((exp) => {
          const selectedIds = selectedBulletIds(exp);
          // Resolved through the id list (not by filtering exp.bullets) so the
          // on-screen order matches bulletSelection's order, which is the
          // order the CV renders them in.
          const selectedBullets = selectedIds
            .map((id) => exp.bullets.find((b) => b.id === id))
            .filter((b): b is BulletEntry => b !== undefined);
          const availableToAdd = exp.bullets.filter((b) => !selectedIds.includes(b.id));

          return (
            <details key={exp.id} open className="rounded border border-neutral-200 p-4">
              <summary className="cursor-pointer select-none text-xs font-semibold text-neutral-800">
                {exp.title} — {exp.company}
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {selectedBullets.map((bullet) => (
                  <li key={bullet.id} className="rounded border border-neutral-200 p-3">
                    <textarea
                      value={bullet[bulletField] ?? ""}
                      onChange={(e) => onBulletChange(exp.id, bullet.id, e.target.value)}
                      rows={2}
                      className={`${INPUT_CLASS} w-full`}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={tagsToText(bullet.tags)}
                        onChange={(e) => onBulletTagsChange(exp.id, bullet.id, e.target.value)}
                        placeholder="Tags (comma-separated)"
                        className={`${INPUT_CLASS} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveBullet(exp, bullet.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {availableToAdd.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onAddBullet(exp, e.target.value);
                  }}
                  className={`${INPUT_CLASS} mt-3 w-full`}
                >
                  <option value="">+ Add bullet from profile…</option>
                  {availableToAdd.map((bullet) => (
                    <option key={bullet.id} value={bullet.id}>
                      {bullet.id}:{" "}
                      {bullet.text.length > BULLET_OPTION_PREVIEW_LENGTH
                        ? `${bullet.text.slice(0, BULLET_OPTION_PREVIEW_LENGTH)}…`
                        : bullet.text}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-3 text-xs text-neutral-400">
                  All of this role&apos;s profile bullets are already included.
                </p>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}
