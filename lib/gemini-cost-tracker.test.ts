/**
 * Plain node:assert unit tests for the pure parts of the cost tracker —
 * run via `pnpm run test`. Same no-framework style as assemble.test.ts.
 *
 * Only the pure helpers are covered here: the quota counter, usage log and
 * credit balance all need MongoDB, so they're exercised by the live
 * end-to-end run instead.
 */
import assert from "node:assert/strict";
import { computeCallCost, extractUsage, pacificQuotaDay, resolveModelId, PRICING } from "./gemini-cost-tracker";

// ─── Pricing table ──────────────────────────────────────────────────────────

// Verified against ai.google.dev/gemini-api/docs/pricing.
assert.equal(PRICING["gemini-2.5-flash-lite"].inputPerMillion, 0.1);
assert.equal(PRICING["gemini-2.5-flash-lite"].outputPerMillion, 0.4);
assert.equal(PRICING["gemini-2.5-flash"].inputPerMillion, 0.3);
assert.equal(PRICING["gemini-2.5-flash"].outputPerMillion, 2.5);

// ─── computeCallCost ────────────────────────────────────────────────────────

// 1M in + 1M out on 2.5-flash = $0.30 + $2.50.
{
  const { usd } = computeCallCost("gemini-2.5-flash", 1_000_000, 1_000_000);
  assert.ok(Math.abs(usd - 2.8) < 1e-9, `expected 2.80, got ${usd}`);
}

// A realistic call: cost should be tiny but strictly positive, never rounded to 0.
{
  const { usd, mad } = computeCallCost("gemini-2.5-flash", 8000, 1200);
  assert.ok(usd > 0, "a real call must not cost exactly 0 on the paid tier");
  assert.ok(Math.abs(usd - (0.0024 + 0.003)) < 1e-9, `unexpected usd ${usd}`);
  assert.ok(mad > usd, "MAD is worth less than USD, so the MAD figure must be larger");
}

// Zero tokens is free on any tier.
assert.equal(computeCallCost("gemini-2.5-flash-lite", 0, 0).usd, 0);

// ─── Rolling alias resolution ───────────────────────────────────────────────

// The alias must not be priced at 0 just because it isn't a PRICING key —
// that was the whole failure mode this fallback exists to prevent.
assert.equal(resolveModelId("gemini-flash-lite-latest"), "gemini-2.5-flash-lite");
assert.ok(computeCallCost("gemini-flash-lite-latest", 1_000_000, 0).usd > 0);

// A concrete id resolves to itself.
assert.equal(resolveModelId("gemini-2.5-flash"), "gemini-2.5-flash");

// ─── extractUsage ───────────────────────────────────────────────────────────

// Thinking tokens bill at the output rate, so they belong in outputTokens.
{
  const { inputTokens, outputTokens } = extractUsage({
    promptTokenCount: 100,
    candidatesTokenCount: 50,
    thoughtsTokenCount: 400,
  });
  assert.equal(inputTokens, 100);
  assert.equal(outputTokens, 450, "thoughtsTokenCount must be counted as output");
}

// Missing/partial metadata degrades to zeros rather than NaN — a NaN would
// propagate into the totals and corrupt the running balance permanently.
{
  const { inputTokens, outputTokens } = extractUsage(undefined);
  assert.equal(inputTokens, 0);
  assert.equal(outputTokens, 0);
  const partial = extractUsage({ promptTokenCount: 7 });
  assert.equal(partial.inputTokens, 7);
  assert.equal(partial.outputTokens, 0);
  assert.ok(!Number.isNaN(computeCallCost("gemini-2.5-flash-lite", partial.inputTokens, partial.outputTokens).usd));
}

// ─── Pacific quota day ──────────────────────────────────────────────────────

// Summer (PDT, UTC-7): the Pacific day rolls over at 07:00 UTC. So 06:00 UTC
// on the 16th is still the 15th in Pacific — exactly the window a midnight-UTC
// reset would misclassify.
assert.equal(pacificQuotaDay(new Date("2026-08-16T06:00:00Z")), "2026-08-15");
assert.equal(pacificQuotaDay(new Date("2026-08-16T07:30:00Z")), "2026-08-16");

// Winter (PST, UTC-8): the rollover moves an hour later, to 08:00 UTC. Pinned
// so that swapping Intl for a hardcoded offset fails here instead of silently
// drifting for half the year.
assert.equal(pacificQuotaDay(new Date("2026-01-16T07:30:00Z")), "2026-01-15");
assert.equal(pacificQuotaDay(new Date("2026-01-16T08:30:00Z")), "2026-01-16");

// Well inside the Pacific day, UTC and Pacific agree on the date.
assert.equal(pacificQuotaDay(new Date("2026-08-16T18:00:00Z")), "2026-08-16");

console.log("gemini-cost-tracker.test.ts: all assertions passed");
