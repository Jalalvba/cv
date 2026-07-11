import { NextRequest, NextResponse } from "next/server";
import type { UpdateFilter } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { updateProfileRequestSchema } from "@/lib/validation";
import { parseJsonBody, zodErrorResponse, errorMessage } from "@/lib/api-errors";
import { getProfile, PROFILE_ID } from "@/lib/profile";
import type { ProfileDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const parsedBody = await parseJsonBody<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = updateProfileRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return zodErrorResponse(parsed);
  }
  const { personal, education, bullets, bulletTags, educationAdd, educationRemove } = parsed.data;

  const db = await getDb();
  const collection = db.collection<ProfileDoc>("profile");
  let profile: ProfileDoc;
  try {
    profile = await getProfile(db);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 404 });
  }

  // Validate every referenced id exists before writing anything, so a bad id
  // in one edit can't leave the others partially applied.
  const educationIds = new Set(profile.education.map((e) => e.id));
  for (const edu of education ?? []) {
    if (!educationIds.has(edu.id)) {
      return NextResponse.json({ error: `Unknown education id: "${edu.id}"` }, { status: 400 });
    }
  }
  for (const id of educationRemove ?? []) {
    if (!educationIds.has(id)) {
      return NextResponse.json({ error: `Unknown education id: "${id}"` }, { status: 400 });
    }
  }
  for (const e of educationAdd ?? []) {
    if (educationIds.has(e.id)) {
      return NextResponse.json({ error: `Education id "${e.id}" already exists — ids must be unique` }, { status: 400 });
    }
  }
  const bulletIdsByExperience = new Map(profile.experience.map((exp) => [exp.id, new Set(exp.bullets.map((b) => b.id))]));
  for (const b of [...(bullets ?? []), ...(bulletTags ?? [])]) {
    const bulletIds = bulletIdsByExperience.get(b.experienceId);
    if (!bulletIds || !bulletIds.has(b.bulletId)) {
      return NextResponse.json(
        { error: `Unknown bullet: experience "${b.experienceId}", bullet "${b.bulletId}"` },
        { status: 400 },
      );
    }
  }

  const saved: string[] = [];

  if (personal && Object.keys(personal).length > 0) {
    // Values here are a mix of strings (name/email/...) and the languages
    // array — both are just "replace this field's whole value" $set writes.
    const setFields: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(personal)) {
      setFields[`personal.${field}`] = value;
      saved.push(`personal.${field}`);
    }
    await collection.updateOne({ _id: PROFILE_ID }, { $set: setFields });
  }

  for (const edu of education ?? []) {
    const { id, ...fields } = edu;
    if (Object.keys(fields).length === 0) continue;
    const setFields: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(fields)) {
      setFields[`education.$[edu].${field}`] = value;
      saved.push(`education.${id}.${field}`);
    }
    // arrayFilters placeholder paths (e.g. "education.$[edu].degree") aren't
    // representable in the driver's strict dotted-key types for ProfileDoc,
    // so this single update boundary is cast — same pattern as the
    // renderToBuffer() cast in app/api/export-pdf/route.ts.
    await collection.updateOne(
      { _id: PROFILE_ID },
      { $set: setFields } as UpdateFilter<ProfileDoc>,
      { arrayFilters: [{ "edu.id": id }] },
    );
  }

  for (const b of bullets ?? []) {
    const field = b.field ?? "text";
    await collection.updateOne(
      { _id: PROFILE_ID },
      { $set: { [`experience.$[exp].bullets.$[bul].${field}`]: b.text } } as UpdateFilter<ProfileDoc>,
      { arrayFilters: [{ "exp.id": b.experienceId }, { "bul.id": b.bulletId }] },
    );
    saved.push(`experience.${b.experienceId}.bullets.${b.bulletId}.${field}`);
  }

  for (const bt of bulletTags ?? []) {
    await collection.updateOne(
      { _id: PROFILE_ID },
      { $set: { [`experience.$[exp].bullets.$[bul].tags`]: bt.tags } } as UpdateFilter<ProfileDoc>,
      { arrayFilters: [{ "exp.id": bt.experienceId }, { "bul.id": bt.bulletId }] },
    );
    saved.push(`experience.${bt.experienceId}.bullets.${bt.bulletId}.tags`);
  }

  // Removal before addition — arbitrary but deterministic; the two can never
  // target the same id (checked above), so order doesn't affect correctness.
  if (educationRemove && educationRemove.length > 0) {
    await collection.updateOne(
      { _id: PROFILE_ID },
      { $pull: { education: { id: { $in: educationRemove } } } } as UpdateFilter<ProfileDoc>,
    );
    saved.push(...educationRemove.map((id) => `education.${id} (removed)`));
  }

  if (educationAdd && educationAdd.length > 0) {
    await collection.updateOne(
      { _id: PROFILE_ID },
      { $push: { education: { $each: educationAdd } } } as UpdateFilter<ProfileDoc>,
    );
    saved.push(...educationAdd.map((e) => `education.${e.id} (added)`));
  }

  return NextResponse.json({ saved });
}
