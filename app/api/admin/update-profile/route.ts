import { NextRequest, NextResponse } from "next/server";
import type { UpdateFilter } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { updateProfileRequestSchema } from "@/lib/validation";
import type { ProfileDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: `Invalid JSON: ${errorMessage(err)}` }, { status: 400 });
  }

  const parsed = updateProfileRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return NextResponse.json({ error: issues[0]?.message ?? "Validation failed", issues }, { status: 400 });
  }
  const { personal, education, bullets } = parsed.data;

  const db = await getDb();
  const collection = db.collection<ProfileDoc>("profile");
  const profile = await collection.findOne({ _id: "jalal_chafiq" });
  if (!profile) {
    return NextResponse.json({ error: 'Profile document not found (_id: "jalal_chafiq").' }, { status: 404 });
  }

  // Validate every referenced id exists before writing anything, so a bad id
  // in one edit can't leave the others partially applied.
  const educationIds = new Set(profile.education.map((e) => e.id));
  for (const edu of education ?? []) {
    if (!educationIds.has(edu.id)) {
      return NextResponse.json({ error: `Unknown education id: "${edu.id}"` }, { status: 400 });
    }
  }
  const bulletIdsByExperience = new Map(profile.experience.map((exp) => [exp.id, new Set(exp.bullets.map((b) => b.id))]));
  for (const b of bullets ?? []) {
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
    const setFields: Record<string, string> = {};
    for (const [field, value] of Object.entries(personal)) {
      setFields[`personal.${field}`] = value;
      saved.push(`personal.${field}`);
    }
    await collection.updateOne({ _id: "jalal_chafiq" }, { $set: setFields });
  }

  for (const edu of education ?? []) {
    const { id, ...fields } = edu;
    if (Object.keys(fields).length === 0) continue;
    const setFields: Record<string, string> = {};
    for (const [field, value] of Object.entries(fields)) {
      setFields[`education.$[edu].${field}`] = value as string;
      saved.push(`education.${id}.${field}`);
    }
    // arrayFilters placeholder paths (e.g. "education.$[edu].degree") aren't
    // representable in the driver's strict dotted-key types for ProfileDoc,
    // so this single update boundary is cast — same pattern as the
    // renderToBuffer() cast in app/api/export-pdf/route.ts.
    await collection.updateOne(
      { _id: "jalal_chafiq" },
      { $set: setFields } as UpdateFilter<ProfileDoc>,
      { arrayFilters: [{ "edu.id": id }] },
    );
  }

  for (const b of bullets ?? []) {
    const field = b.field ?? "text";
    await collection.updateOne(
      { _id: "jalal_chafiq" },
      { $set: { [`experience.$[exp].bullets.$[bul].${field}`]: b.text } } as UpdateFilter<ProfileDoc>,
      { arrayFilters: [{ "exp.id": b.experienceId }, { "bul.id": b.bulletId }] },
    );
    saved.push(`experience.${b.experienceId}.bullets.${b.bulletId}.${field}`);
  }

  return NextResponse.json({ saved });
}
