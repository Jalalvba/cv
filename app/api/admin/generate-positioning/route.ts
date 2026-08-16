import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { parseJsonBody, zodErrorResponse, errorMessage } from "@/lib/api-errors";
import { generateJsonWithFallback, getDefaultModel, GeminiError } from "@/lib/gemini";
import { getActiveGeminiModel } from "@/lib/getDynamicModel";
import { DEFAULT_TIER } from "@/lib/geminiModels";
import { callGeminiWithTracking } from "@/lib/gemini-cost-tracker";
import {
  EXAMPLE_POSITIONING_ID,
  EXAMPLE_POSITIONING_ID_EN,
  buildContextPromptMarkdown,
} from "@/lib/context-prompt";
import { generatePositioningRequestSchema, positioningDocSchema } from "@/lib/validation";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

/**
 * Live replacement for the manual "paste the context prompt into a chat UI,
 * copy the JSON back" loop. Takes a job offer's text, builds the exact same
 * context prompt the /admin/positionings download button produces, sends it
 * to Gemini in JSON mode, and returns a validated FR/EN PositioningDoc pair.
 *
 * This route deliberately does NOT write to MongoDB — it returns the pair for
 * review in the admin page's existing paste box, which then goes through the
 * unchanged POST /api/admin/seed-positioning path. Generated content is always
 * read by a human before it can reach a CV.
 */

/**
 * Gemini's responseSchema is an OpenAPI subset with no open-ended map type,
 * so PositioningDoc.bulletSelection (a `Record<string, string[]>`) can't be
 * expressed directly. It's requested as an array of {experienceId, bulletIds}
 * pairs and folded back into a record below — the model returns a list, which
 * the schema can constrain, and the app still gets its record shape.
 */
const RESPONSE_SCHEMA = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: {
    type: "object",
    properties: {
      _id: { type: "string" },
      roleGroup: { type: "string" },
      targetTitle: { type: "string" },
      summary: { type: "string" },
      skillsOrder: { type: "array", items: { type: "string" } },
      bulletSelection: {
        type: "array",
        items: {
          type: "object",
          properties: {
            experienceId: { type: "string" },
            bulletIds: { type: "array", items: { type: "string" } },
          },
          required: ["experienceId", "bulletIds"],
        },
      },
      format: { type: "string", enum: ["visual", "ats"] },
      language: { type: "string", enum: ["en", "fr"] },
    },
    required: ["_id", "roleGroup", "targetTitle", "summary", "skillsOrder", "bulletSelection", "format", "language"],
    propertyOrdering: [
      "_id",
      "roleGroup",
      "targetTitle",
      "summary",
      "skillsOrder",
      "bulletSelection",
      "format",
      "language",
    ],
  },
} as const;

const RESPONSE_ENVELOPE_NOTE = `
## Response format (IMPORTANT — differs slightly from the example above)

Return a JSON array of exactly two PositioningDoc objects: the FR object first, then the EN object.

One deviation from the examples shown above: \`bulletSelection\` must be returned as an ARRAY of
{ "experienceId": string, "bulletIds": string[] } objects rather than as an object keyed by experience id.
The server converts it back. Everything else matches the documented shape exactly.

Both objects must share the same roleGroup, and their _id values must be "{roleGroup}_fr" and "{roleGroup}_en".
Set draftTranslation on neither — the server marks the FR variant as a draft translation automatically.
`;

interface RawBulletSelectionEntry {
  experienceId: string;
  bulletIds: string[];
}

/** Folds the array-of-pairs response envelope back into PositioningDoc's record shape. */
function toBulletSelectionRecord(raw: unknown): Record<string, string[]> | null {
  if (!Array.isArray(raw)) return null;
  const record: Record<string, string[]> = {};
  for (const entry of raw as RawBulletSelectionEntry[]) {
    if (!entry || typeof entry.experienceId !== "string" || !Array.isArray(entry.bulletIds)) return null;
    record[entry.experienceId] = entry.bulletIds;
  }
  return record;
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const parsedBody = await parseJsonBody<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = generatePositioningRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) return zodErrorResponse(parsed);
  const { jobOffer, modelTier } = parsed.data;

  // Fetched fresh per request, exactly like the download button does client-side,
  // so a generated positioning always reflects the current profile.
  let profile: ProfileDoc | null;
  let examplePair: (PositioningDoc | null)[];
  try {
    const db = await getDb();
    [profile, ...examplePair] = await Promise.all([
      db.collection<ProfileDoc>("profile").findOne({ _id: "jalal_chafiq" }),
      db.collection<PositioningDoc>("positionings").findOne({ _id: EXAMPLE_POSITIONING_ID }),
      db.collection<PositioningDoc>("positionings").findOne({ _id: EXAMPLE_POSITIONING_ID_EN }),
    ]);
  } catch (err) {
    return NextResponse.json({ error: `MongoDB read failed: ${errorMessage(err)}` }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile document "jalal_chafiq" not found. Run `pnpm run db:seed`.' }, { status: 404 });
  }
  const examples = examplePair.filter((doc): doc is PositioningDoc => doc !== null);
  if (examples.length < 2) {
    return NextResponse.json(
      { error: `Example positionings (${EXAMPLE_POSITIONING_ID}, ${EXAMPLE_POSITIONING_ID_EN}) not found. Run \`pnpm run db:seed\`.` },
      { status: 404 },
    );
  }

  const systemInstruction = buildContextPromptMarkdown(profile, examples) + RESPONSE_ENVELOPE_NOTE;

  // Routed through callGeminiWithTracking rather than calling generateJson
  // directly, so this action can never skip quota/cost accounting — and so
  // costInfo comes back in the same round trip as the result, ready to hand
  // straight to the client below.
  let raw: unknown;
  let costInfo;
  try {
    // Resolved live (see lib/getDynamicModel.ts) purely to name the quota
    // slot claimed up front; the actual call may still step up a tier via
    // generateJsonWithFallback below, in which case billing keys off
    // whatever modelVersion the response reports, not this value.
    const startTier = modelTier ?? DEFAULT_TIER;
    const startModel = modelTier ? await getActiveGeminiModel(modelTier) : await getDefaultModel();
    const tracked = await callGeminiWithTracking({
      model: startModel,
      action: "generate-positioning",
      call: async () => {
        // Starts at the requested (or default) tier and steps up to a
        // pricier tier on a retryable failure (quota/5xx) — see
        // generateJsonWithFallback.
        const res = await generateJsonWithFallback({
          systemInstruction,
          userPrompt: `Here is the job offer. Produce the FR/EN PositioningDoc pair for it.\n\n---\n\n${jobOffer}`,
          responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
          startTier,
        });
        return { result: res.json, usage: res.usage, modelVersion: res.modelVersion ?? res.model };
      },
    });
    raw = tracked.result;
    costInfo = tracked.costInfo;
  } catch (err) {
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Positioning generation failed." }, { status: 500 });
  }

  // The call already happened and already cost money, so every rejection past
  // this point still reports costInfo — otherwise a rejected generation would
  // silently spend credit with nothing shown for it.
  const rejected = (error: string) => NextResponse.json({ error, costInfo }, { status: 502 });

  if (!Array.isArray(raw) || raw.length !== 2) {
    return rejected("Gemini did not return exactly two positioning documents (one FR, one EN).");
  }

  const positionings: PositioningDoc[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const bulletSelection = toBulletSelectionRecord(item.bulletSelection);
    if (!bulletSelection) {
      return rejected(`Gemini returned an unreadable bulletSelection for item ${i}.`);
    }
    const result = positioningDocSchema.safeParse({ ...item, bulletSelection });
    if (!result.success) {
      const itemId = typeof item._id === "string" ? item._id : "unknown _id";
      // Same {error, issues} body the other routes produce, with costInfo
      // folded in for the reason described on `rejected` above.
      const zodResponse = zodErrorResponse(result, {
        prefix: `Gemini returned an invalid document for item ${i} (${itemId})`,
      });
      return NextResponse.json({ ...(await zodResponse.json()), costInfo }, { status: 502 });
    }
    positionings.push(result.data);
  }

  // Rules the schema can't express, checked here because an invented bullet id
  // would parse fine and then silently render an empty role on the CV.
  const validIds = new Map(profile.experience.map((exp) => [exp.id, new Set(exp.bullets.map((b) => b.id))]));
  for (const doc of positionings) {
    for (const [experienceId, bulletIds] of Object.entries(doc.bulletSelection)) {
      const known = validIds.get(experienceId);
      if (!known) {
        return rejected(`Gemini referenced an unknown experience id "${experienceId}" in ${doc._id}.`);
      }
      const unknownBullet = bulletIds.find((id) => !known.has(id));
      if (unknownBullet) {
        return rejected(`Gemini invented bullet id "${unknownBullet}" under "${experienceId}" in ${doc._id}.`);
      }
    }
  }

  const [first, second] = positionings;
  if (first.roleGroup !== second.roleGroup) {
    return rejected(`Gemini returned mismatched roleGroups ("${first.roleGroup}" vs "${second.roleGroup}").`);
  }
  const languages = new Set(positionings.map((doc) => doc.language));
  if (languages.size !== 2) {
    return rejected("Gemini returned two documents in the same language, not an FR/EN pair.");
  }
  // Per DOCS.md §7.2 the pair must surface the same bullets in the same order —
  // only targetTitle/summary/skillsOrder are translated.
  if (JSON.stringify(first.bulletSelection) !== JSON.stringify(second.bulletSelection)) {
    return rejected(
      "Gemini returned different bulletSelection values for the FR and EN variants; they must be identical.",
    );
  }

  // Machine-translated until a human reviews it — same flag scripts/seed.ts uses.
  const reviewed = positionings.map((doc) =>
    doc.language === "fr" ? { ...doc, draftTranslation: true } : doc,
  );

  // costInfo travels back with the result in this same response — the UI
  // renders it via <CostBadge/> with no extra request.
  return NextResponse.json({ positionings: reviewed, model: costInfo.model, costInfo });
}
