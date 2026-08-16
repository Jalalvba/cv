import type { CostInfo } from "@/lib/gemini-cost-tracker";

/**
 * Renders the cost of one Gemini call, for display next to that call's result.
 *
 * Every action that calls Gemini returns `costInfo` inline in its own response
 * (see lib/gemini-cost-tracker.ts's callGeminiWithTracking), so this only ever
 * renders data the action already handed back — it never fetches anything.
 *
 * Shared by every action's UI so the presentation stays identical as more
 * actions are added.
 */
export function CostBadge({ costInfo }: { costInfo: CostInfo | null | undefined }) {
  if (!costInfo) return null;

  const { tier, costMad, inputTokens, outputTokens, model, remainingCreditUsd } = costInfo;
  const isFree = tier === "free";

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1 text-[11px] ${
        isFree ? "border-green-300 bg-green-50 text-green-800" : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
      // The free/paid split is this app's own estimate, not Google's billing —
      // the title makes that visible on hover without cluttering the badge.
      title={
        isFree
          ? "Estimated free tier — based on this app's own daily call count, not Google's billing. Cross-check at aistudio.google.com/usage."
          : `Estimated cost. Credit remaining: $${remainingCreditUsd.toFixed(4)}. Cross-check at aistudio.google.com/usage.`
      }
    >
      <span className="font-semibold">
        {/* 4dp because a Flash-Lite call routinely costs well under 0.01 MAD;
            rounding to 2 would show almost every call as "0.00 MAD". */}
        {costMad.toFixed(4)} MAD
      </span>
      <span>· {isFree ? "free tier" : "paid"}</span>
      <span className="text-neutral-500">
        · {inputTokens} in / {outputTokens} out
      </span>
      <span className="text-neutral-400">· {model}</span>
    </span>
  );
}
