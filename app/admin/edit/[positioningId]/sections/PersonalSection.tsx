"use client";

import type { ProfileDoc } from "@/lib/cv-data";
import type { AddressField, PersonalField } from "../usePositioningEditor";
import { INPUT_CLASS } from "../fields";

/**
 * Personal details from the profile document: contact fields, the structured
 * address, date of birth, and spoken languages. Every positioning shares
 * these — editing them here changes them on every CV, unlike the positioning
 * fields above.
 */

/** Rendered as one text input each, in this order. */
const PERSONAL_FIELDS: PersonalField[] = ["name", "email", "phone", "location", "website"];

/**
 * `address` is stored broken out into fields (for application forms that ask
 * for them separately) but only street/postalCode reach the CV's contact
 * line — city/country would duplicate `location`. See lib/assemble.ts.
 */
const ADDRESS_FIELDS: { field: AddressField; label: string }[] = [
  { field: "street", label: "Street Address" },
  { field: "postalCode", label: "Postal Code" },
  { field: "city", label: "City" },
  { field: "country", label: "Country" },
];

export function PersonalSection({
  personal,
  onPersonalChange,
  onAddressChange,
  onAddLanguage,
  onLanguageChange,
  onRemoveLanguage,
}: {
  personal: ProfileDoc["personal"];
  onPersonalChange: (field: PersonalField, value: string) => void;
  onAddressChange: (field: AddressField, value: string) => void;
  onAddLanguage: () => void;
  onLanguageChange: (index: number, field: "lang" | "level", value: string) => void;
  onRemoveLanguage: (index: number) => void;
}) {
  return (
    <section className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="text-sm font-semibold text-cv-navy">Personal</h2>

      <div className="mt-3 grid grid-cols-2 gap-4">
        {PERSONAL_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-xs">
            <span className="font-medium capitalize text-neutral-700">{field}</span>
            <input
              value={personal[field] ?? ""}
              onChange={(e) => onPersonalChange(field, e.target.value)}
              placeholder={field === "website" ? "example.com" : undefined}
              className={INPUT_CLASS}
            />
          </label>
        ))}
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-neutral-700">
          Address <span className="font-normal text-neutral-400">(shown on the CV, alongside Location)</span>
        </span>
        <div className="mt-2 grid grid-cols-2 gap-4">
          {ADDRESS_FIELDS.map(({ field, label }) => (
            <label key={field} className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-neutral-700">{label}</span>
              <input
                value={personal.address?.[field] ?? ""}
                onChange={(e) => onAddressChange(field, e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="flex max-w-[calc(50%-0.5rem)] flex-col gap-1 text-xs">
          <span className="font-medium text-neutral-700">
            Date of birth{" "}
            <span className="font-normal text-neutral-400">(age is shown on the CV, computed automatically)</span>
          </span>
          <input
            type="date"
            value={personal.dateOfBirth ?? ""}
            onChange={(e) => onPersonalChange("dateOfBirth", e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-neutral-700">Languages</span>
        <div className="mt-2 flex flex-col gap-2">
          {personal.languages.map((language, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={language.lang}
                onChange={(e) => onLanguageChange(index, "lang", e.target.value)}
                placeholder="Language"
                className={`${INPUT_CLASS} flex-1`}
              />
              <input
                value={language.level}
                onChange={(e) => onLanguageChange(index, "level", e.target.value)}
                placeholder="Level"
                className={`${INPUT_CLASS} flex-1`}
              />
              <button
                type="button"
                onClick={() => onRemoveLanguage(index)}
                aria-label="Remove language"
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddLanguage}
            className="mt-1 self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
          >
            + Add language
          </button>
        </div>
      </div>
    </section>
  );
}
