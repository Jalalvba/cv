"use client";

import { INPUT_CLASS } from "../fields";

/**
 * The two positioning-owned prose fields — the headline shown under the name
 * on the CV, and the professional summary paragraph. Both belong to the
 * PositioningDoc, not the profile: they are this application's framing of
 * the same underlying facts, so they change per positioning while the
 * profile stays fixed.
 *
 * @param targetTitle Current headline value.
 * @param summary Current summary value.
 * @param onTargetTitleChange Called with the new headline on every keystroke.
 * @param onSummaryChange Called with the new summary on every keystroke.
 */
export function PositioningSection({
  targetTitle,
  summary,
  onTargetTitleChange,
  onSummaryChange,
}: {
  targetTitle: string;
  summary: string;
  onTargetTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-cv-navy">Positioning</h2>
      <div className="mt-3 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-neutral-700">Target title</span>
          <input value={targetTitle} onChange={(e) => onTargetTitleChange(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-neutral-700">Summary</span>
          <textarea value={summary} onChange={(e) => onSummaryChange(e.target.value)} rows={4} className={INPUT_CLASS} />
        </label>
      </div>
    </section>
  );
}
