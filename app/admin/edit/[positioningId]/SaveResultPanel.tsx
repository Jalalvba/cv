"use client";

import { ZodIssuesList } from "@/components/ZodIssuesList";
import type { SaveOutcome, SaveResult } from "./usePositioningEditor";

/**
 * Per-document outcome line. Both PATCH routes report back the same way, so
 * this renders either one from the same markup.
 */
function OutcomeLine({ label, outcome }: { label: string; outcome: SaveOutcome }) {
  return (
    <div className={outcome.ok ? "text-green-700" : "text-red-600"}>
      <p>
        {label}: {outcome.ok ? "✓" : "✗"} {outcome.detail}
      </p>
      {outcome.issues ? <ZodIssuesList issues={outcome.issues} /> : null}
    </div>
  );
}

/**
 * Reports what the last save actually persisted, per document.
 *
 * The amber `unsupported` panel is the important part: the editor form can
 * express edits the targeted PATCH routes can't (see ./diff.ts), and those
 * are surfaced here rather than silently dropped — a user who renamed a role
 * and saw a green success message would otherwise believe it was stored.
 */
export function SaveResultPanel({ result }: { result: SaveResult }) {
  const nothingAttempted = !result.profile && !result.positioning;

  return (
    <div className="mx-6 mt-4 flex flex-col gap-1 text-xs">
      {result.profile ? <OutcomeLine label="Profile (personal/education/bullets)" outcome={result.profile} /> : null}
      {result.positioning ? (
        <OutcomeLine label="Positioning (title/summary/skills/bulletSelection)" outcome={result.positioning} />
      ) : null}
      {nothingAttempted ? <p className="text-neutral-500">No changes to save.</p> : null}
      {result.unsupported.length > 0 ? (
        <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          <p className="font-semibold">
            Not saved — not supported by Save (structural adds/removes outside this form&apos;s controls; use the
            Generate from job offer tool instead):
          </p>
          <ul className="mt-1 list-disc pl-4">
            {result.unsupported.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
