/**
 * Imported lazily rather than at module load because lib/db.ts throws on a
 * missing MONGODB_URI as soon as it's evaluated. Keeping it dynamic lets the
 * pure pricing helpers below (computeCallCost, extractUsage, pacificQuotaDay)
 * be imported and unit-tested without a database.
 */
async function db() {
  const { getDb } = await import("@/lib/db");
  return getDb();
}

/**
 * Gemini API cost tracking — pricing, free-tier estimation, usage history and
 * prepaid-credit accounting.
 *
 * ─── What is and isn't authoritative ────────────────────────────────────────
 * The Gemini API does NOT tell you whether a call was served free or billed.
 * The response's usageMetadata.serviceTier field looks like it might, but it
 * reports the *latency* tier ("standard" / "priority" / "flex"), not billing.
 * Google tracks free-tier consumption server-side and exposes it only in the
 * AI Studio dashboard.
 *
 * So the free/paid split below is an ESTIMATE derived from this app's own
 * call count. It is wrong whenever the same API key is used from anywhere
 * else (another project, a script, the AI Studio playground), and it cannot
 * see quota this key burned before this module started counting.
 *
 * >>> Cross-check the totals against the real usage dashboard periodically:
 * >>> https://aistudio.google.com/usage — treat that as the source of truth
 * >>> for money, and this module as a live approximation for the UI.
 *
 * All state lives in MongoDB rather than on disk: this app runs on Vercel,
 * where the filesystem is ephemeral, per-instance, and reset on every deploy,
 * so a JSON/SQLite counter would appear to work locally and then silently
 * lose the prepaid balance in production.
 */

// ─── Pricing ────────────────────────────────────────────────────────────────

export interface ModelPrice {
  /** USD per 1M input (prompt) tokens. */
  inputPerMillion: number;
  /** USD per 1M output tokens. Thinking tokens bill at this rate too. */
  outputPerMillion: number;
  /**
   * Estimated free-tier requests per day. Google no longer publishes fixed
   * per-model RPD figures — the rate-limits page now says limits "depend on a
   * variety of factors (such as your usage tier) and can be viewed in Google
   * AI Studio" — so this is a conservative guess, not a documented number.
   * Check your own limit at https://aistudio.google.com/rate-limit and correct
   * it here if it differs.
   */
  freeRequestsPerDay: number;
}

/**
 * Keyed by the CONCRETE model id, verified against ai.google.dev/gemini-api/docs/pricing.
 * Add new models here — nothing else needs to change. Keep this in sync with
 * lib/gemini-models.ts's GEMINI_MODELS registry.
 *
 * These are the ids the API itself reports back in `modelVersion`, and the
 * form these keys must match.
 */
export const PRICING: Record<string, ModelPrice> = {
  "gemini-2.5-flash-lite": { inputPerMillion: 0.1, outputPerMillion: 0.4, freeRequestsPerDay: 1000 },
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5, freeRequestsPerDay: 250 },
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10, freeRequestsPerDay: 50 },
};

/**
 * Rolling aliases ("gemini-flash-lite-latest") match no PRICING key, and
 * Google doesn't document what they resolve to. Every generateContent
 * response carries a `modelVersion` naming the concrete model that actually
 * served the request, so billing keys off THAT (see callGeminiWithTracking).
 * This map is only the fallback for when a response omits it.
 */
const ALIAS_FALLBACK: Record<string, string> = {
  "gemini-flash-lite-latest": "gemini-2.5-flash-lite",
  "gemini-flash-latest": "gemini-2.5-flash",
  "gemini-pro-latest": "gemini-2.5-pro",
};

/**
 * Charged when a model isn't in PRICING. Deliberately the most expensive
 * Flash-Lite rate rather than 0: an unknown model silently costing nothing
 * would hide real spend, which is the opposite of this module's purpose.
 */
const UNKNOWN_MODEL_PRICE: ModelPrice = {
  inputPerMillion: 0.3,
  outputPerMillion: 2.5,
  freeRequestsPerDay: 0,
};

export function resolveModelId(model: string): string {
  return PRICING[model] ? model : (ALIAS_FALLBACK[model] ?? model);
}

export function priceFor(model: string): ModelPrice {
  const price = PRICING[resolveModelId(model)];
  if (!price) {
    console.warn(
      `[gemini-cost] No pricing entry for model "${model}" — billing it at the highest Flash-Lite rate. Add it to PRICING in lib/gemini-cost-tracker.ts.`,
    );
    return UNKNOWN_MODEL_PRICE;
  }
  return price;
}

// ─── Currency ───────────────────────────────────────────────────────────────

/** MAD per USD. Override with USD_TO_MAD_RATE; a non-numeric value falls back to the default. */
export const USD_TO_MAD: number = (() => {
  const raw = process.env.USD_TO_MAD_RATE;
  const parsed = raw === undefined ? NaN : Number(raw);
  if (raw !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
    console.warn(`[gemini-cost] USD_TO_MAD_RATE="${raw}" is not a positive number — using 9.4.`);
  }
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 9.4;
})();

/**
 * Cost of one call. Pass the concrete model id where possible; an alias still
 * resolves via ALIAS_FALLBACK.
 *
 * `outputTokens` should already include thinking tokens — Google bills
 * thoughtsTokenCount at the output rate (see extractUsage).
 */
export function computeCallCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { usd: number; mad: number } {
  const price = priceFor(model);
  const usd = (inputTokens / 1_000_000) * price.inputPerMillion + (outputTokens / 1_000_000) * price.outputPerMillion;
  return { usd, mad: usd * USD_TO_MAD };
}

// ─── Token extraction ───────────────────────────────────────────────────────

/**
 * The shape of usageMetadata as the API actually returns it — verified against
 * a live generateContent call, not assumed. Fields beyond promptTokenCount /
 * candidatesTokenCount are optional and appear only for some models.
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Reasoning tokens on thinking-enabled models. BILLED AT THE OUTPUT RATE. */
  thoughtsTokenCount?: number;
  /** Portion of the prompt served from context cache (billed cheaper; not modelled separately here). */
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

/**
 * Folds usageMetadata into the two numbers billing needs.
 *
 * thoughtsTokenCount is added to OUTPUT because Google bills it at the output
 * rate. Ignoring it — as a naive promptTokenCount/candidatesTokenCount read
 * does — undercounts the cost of any thinking-enabled model, sometimes by
 * more than the visible output itself.
 */
export function extractUsage(usage: GeminiUsageMetadata | undefined): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  if (!usage) {
    console.warn("[gemini-cost] Response carried no usageMetadata — recording this call as 0 tokens.");
  }
  return { inputTokens, outputTokens };
}

// ─── Free-tier day counter ──────────────────────────────────────────────────

/**
 * Google's docs are explicit: "Requests per day (RPD) quotas reset at midnight
 * Pacific time." NOT midnight UTC. Using UTC would misclassify every call in
 * the 7-8 hour gap (the offset shifts with US daylight saving, which is why
 * this formats in the named zone rather than applying a fixed offset).
 */
export function pacificQuotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface QuotaDoc {
  _id: string; // `${quotaDay}:${model}`
  model: string;
  quotaDay: string;
  calls: number;
}

/**
 * Atomically claims one slot in today's free quota and reports whether it
 * landed inside it. $inc-then-compare (rather than read, decide, write) keeps
 * two concurrent Vercel instances from both seeing the same "last free call"
 * and each taking it.
 */
async function claimQuotaSlot(model: string): Promise<{ tier: "free" | "paid"; callsToday: number }> {
  const quotaDay = pacificQuotaDay();
  const limit = priceFor(model).freeRequestsPerDay;
  const conn = await db();
  const doc = await conn.collection<QuotaDoc>("gemini_quota").findOneAndUpdate(
    { _id: `${quotaDay}:${model}` },
    { $inc: { calls: 1 }, $setOnInsert: { model, quotaDay } },
    { upsert: true, returnDocument: "after" },
  );
  const callsToday = doc?.calls ?? 1;
  return { tier: callsToday <= limit ? "free" : "paid", callsToday };
}

/** Hands back a claimed slot when the call never happened (upstream error). */
async function releaseQuotaSlot(model: string): Promise<void> {
  const conn = await db();
  await conn
    .collection<QuotaDoc>("gemini_quota")
    .updateOne({ _id: `${pacificQuotaDay()}:${model}` }, { $inc: { calls: -1 } });
}

// ─── Totals, log and prepaid credit ─────────────────────────────────────────

export interface UsageTotals {
  _id: string; // model id
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  total_cost_mad: number;
}

export interface UsageLogEntry {
  timestamp: string;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  tier: "free" | "paid";
  cost_usd: number;
  cost_mad: number;
}

/** Starting prepaid balance in USD, from env. */
function startingCreditUsd(): number {
  const raw = process.env.GEMINI_PREPAID_USD_BALANCE;
  const parsed = raw === undefined ? NaN : Number(raw);
  if (raw !== undefined && !Number.isFinite(parsed)) {
    console.warn(`[gemini-cost] GEMINI_PREPAID_USD_BALANCE="${raw}" is not a number — treating it as 0.`);
  }
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Remaining prepaid credit = starting balance − every paid-tier dollar spent.
 *
 * Deliberately DERIVED from the totals rather than stored as its own
 * decrementing field, so there is exactly one place the spend is recorded and
 * no way for a stored balance to drift out of step with the log. This is the
 * same number returned inline as costInfo.remainingCreditUsd.
 */
export async function getRemainingCredit(): Promise<number> {
  const conn = await db();
  const totals = await conn.collection<UsageTotals>("gemini_usage_totals").find({}).toArray();
  const spent = totals.reduce((sum, t) => sum + (t.total_cost_usd ?? 0), 0);
  return startingCreditUsd() - spent;
}

/**
 * Appends the history entry and folds the call into the running totals.
 *
 * Free-tier calls are logged too (with zero cost) — they still consume the
 * daily quota, so leaving them out would make the log useless for explaining
 * why later calls started being billed. Only the money is zero.
 */
async function recordUsage(entry: UsageLogEntry): Promise<void> {
  const conn = await db();
  await conn.collection<UsageLogEntry>("gemini_usage_log").insertOne(entry);
  await conn.collection<UsageTotals>("gemini_usage_totals").updateOne(
    { _id: entry.model },
    {
      $inc: {
        total_calls: 1,
        total_input_tokens: entry.inputTokens,
        total_output_tokens: entry.outputTokens,
        total_cost_usd: entry.cost_usd,
        total_cost_mad: entry.cost_mad,
      },
    },
    { upsert: true },
  );
}

// ─── The contract returned to every action ──────────────────────────────────

export interface CostInfo {
  model: string;
  tier: "free" | "paid";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costMad: number;
  /** Prepaid balance after this call. Unchanged from before the call on the free tier. */
  remainingCreditUsd: number;
}

export interface TrackedCall<T> {
  result: T;
  costInfo: CostInfo;
}

/**
 * Wraps one Gemini call with cost tracking and returns the model output and
 * the cost breakdown together, in one object, so an action can pass costInfo
 * straight through to its own response in the same request/response cycle.
 *
 * EVERY action that calls Gemini must go through this. lib/gemini.ts's
 * transport function is not exported for direct use by routes — routing a
 * call around this wrapper would silently drop it from the quota count, the
 * history and the credit balance.
 *
 * `call` receives nothing and returns the parsed result plus the raw
 * usageMetadata and modelVersion, which keeps this module independent of any
 * particular request shape (prompt, schema, tools, …).
 */
export async function callGeminiWithTracking<T>(opts: {
  /** Model id or rolling alias, as requested. */
  model: string;
  /** Short action name recorded in the history, e.g. "generate-positioning". */
  action: string;
  call: () => Promise<{ result: T; usage: GeminiUsageMetadata | undefined; modelVersion?: string }>;
}): Promise<TrackedCall<T>> {
  // Claimed before the call so concurrent callers can't both take the same
  // free slot; handed back below if the call never actually happened.
  const { tier } = await claimQuotaSlot(resolveModelId(opts.model));

  let outcome: { result: T; usage: GeminiUsageMetadata | undefined; modelVersion?: string };
  try {
    outcome = await opts.call();
  } catch (err) {
    await releaseQuotaSlot(resolveModelId(opts.model)).catch(() => {});
    throw err;
  }

  // Bill against the model the API says actually served the request, not the
  // alias we asked for — that's what makes rolling aliases priceable at all.
  const billedModel = outcome.modelVersion ?? resolveModelId(opts.model);
  const { inputTokens, outputTokens } = extractUsage(outcome.usage);
  const { usd, mad } = tier === "free" ? { usd: 0, mad: 0 } : computeCallCost(billedModel, inputTokens, outputTokens);

  // Never let a bookkeeping failure lose the user their generated result —
  // the call already happened and already cost money.
  try {
    await recordUsage({
      timestamp: new Date().toISOString(),
      action: opts.action,
      model: billedModel,
      inputTokens,
      outputTokens,
      tier,
      cost_usd: usd,
      cost_mad: mad,
    });
  } catch (err) {
    console.error("[gemini-cost] Failed to record usage:", err instanceof Error ? err.message : String(err));
  }

  let remainingCreditUsd = 0;
  try {
    remainingCreditUsd = await getRemainingCredit();
  } catch (err) {
    console.error("[gemini-cost] Failed to read remaining credit:", err instanceof Error ? err.message : String(err));
  }

  return {
    result: outcome.result,
    costInfo: {
      model: billedModel,
      tier,
      inputTokens,
      outputTokens,
      costUsd: usd,
      costMad: mad,
      remainingCreditUsd,
    },
  };
}
