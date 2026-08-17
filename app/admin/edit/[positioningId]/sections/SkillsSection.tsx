"use client";

import { INPUT_CLASS } from "../fields";

/**
 * The positioning's skill list. Order is meaningful — the CV renders these
 * as one "•"-joined line in exactly this sequence, so the strongest match
 * for the target role belongs first; hence the move up/down controls rather
 * than an alphabetical list.
 *
 * These belong to the positioning, not the profile: the same person leads
 * with different skills for a fleet role than for a training one.
 */
export function SkillsSection({
  skills,
  onSkillChange,
  onMoveSkill,
  onRemoveSkill,
  onAddSkill,
}: {
  skills: string[];
  onSkillChange: (index: number, value: string) => void;
  onMoveSkill: (index: number, direction: -1 | 1) => void;
  onRemoveSkill: (index: number) => void;
  onAddSkill: () => void;
}) {
  return (
    <section className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="text-sm font-semibold text-cv-navy">Skills (this positioning only)</h2>
      <div className="mt-3 flex flex-col gap-2">
        {skills.map((skill, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={skill}
              onChange={(e) => onSkillChange(index, e.target.value)}
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              type="button"
              onClick={() => onMoveSkill(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
              className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMoveSkill(index, 1)}
              disabled={index === skills.length - 1}
              aria-label="Move down"
              className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onRemoveSkill(index)}
              aria-label="Remove skill"
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddSkill}
          className="mt-2 self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
        >
          + Add skill
        </button>
      </div>
    </section>
  );
}
