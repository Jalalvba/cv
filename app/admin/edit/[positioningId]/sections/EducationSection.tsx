"use client";

import type { ProfileDoc } from "@/lib/cv-data";
import type { EducationField } from "../usePositioningEditor";
import { INPUT_CLASS, tagsToText } from "../fields";

/**
 * Education entries from the profile document, with add/remove for whole
 * entries. Every positioning shows the full education list unfiltered, so
 * unlike experience bullets there is no per-positioning selection here.
 */

/** Rendered as one text input each, in this order. */
const EDUCATION_FIELDS: EducationField[] = ["degree", "school", "endDate", "honors"];

export function EducationSection({
  education,
  descriptionField,
  onFieldChange,
  onDescriptionChange,
  onTagsChange,
  onAdd,
  onRemove,
}: {
  education: ProfileDoc["education"];
  /**
   * Which description field this positioning edits — "descriptionFr" for an
   * "fr" positioning, "description" otherwise. Passed in rather than derived
   * here so the section never needs to know about the positioning document.
   */
  descriptionField: "description" | "descriptionFr";
  onFieldChange: (id: string, field: EducationField, value: string) => void;
  onDescriptionChange: (id: string, value: string) => void;
  onTagsChange: (id: string, text: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="text-sm font-semibold text-cv-navy">Education</h2>
      <div className="mt-3 flex flex-col gap-4">
        {education.map((entry) => (
          <div key={entry.id} className="rounded border border-neutral-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              {EDUCATION_FIELDS.map((field) => (
                <label key={field} className="flex flex-col gap-1 text-xs">
                  <span className="font-medium capitalize text-neutral-700">{field}</span>
                  <input
                    value={entry[field] ?? ""}
                    onChange={(e) => onFieldChange(entry.id, field, e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">
                Description ({descriptionField === "descriptionFr" ? "FR" : "EN"})
              </span>
              <textarea
                value={entry[descriptionField] ?? ""}
                onChange={(e) => onDescriptionChange(entry.id, e.target.value)}
                rows={2}
                className={INPUT_CLASS}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">Tags (comma-separated)</span>
              <input
                value={tagsToText(entry.tags)}
                onChange={(e) => onTagsChange(entry.id, e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="mt-3 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Remove entry
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
        >
          + Add education entry
        </button>
      </div>
    </section>
  );
}
