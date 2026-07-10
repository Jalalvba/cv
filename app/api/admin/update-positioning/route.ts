import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { updatePositioningRequestSchema } from "@/lib/validation";
import type { PositioningDoc } from "@/lib/cv-data";

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

  const parsed = updatePositioningRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return NextResponse.json({ error: issues[0]?.message ?? "Validation failed", issues }, { status: 400 });
  }
  const { positioningId, skillsOrder, targetTitle, summary } = parsed.data;

  const setFields: Partial<Pick<PositioningDoc, "skillsOrder" | "targetTitle" | "summary">> = {};
  const saved: string[] = [];
  if (skillsOrder !== undefined) {
    setFields.skillsOrder = skillsOrder;
    saved.push("skillsOrder");
  }
  if (targetTitle !== undefined) {
    setFields.targetTitle = targetTitle;
    saved.push("targetTitle");
  }
  if (summary !== undefined) {
    setFields.summary = summary;
    saved.push("summary");
  }

  const db = await getDb();
  const result = await db
    .collection<PositioningDoc>("positionings")
    .updateOne({ _id: positioningId }, { $set: setFields });
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: `Positioning "${positioningId}" not found` }, { status: 404 });
  }

  return NextResponse.json({ saved });
}
