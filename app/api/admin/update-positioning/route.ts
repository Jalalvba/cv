import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { updatePositioningRequestSchema } from "@/lib/validation";
import { parseJsonBody, zodErrorResponse } from "@/lib/api-errors";
import type { PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const parsedBody = await parseJsonBody<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = updatePositioningRequestSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return zodErrorResponse(parsed);
  }
  const { positioningId, skillsOrder, targetTitle, summary, bulletSelection } = parsed.data;

  const setFields: Partial<Pick<PositioningDoc, "skillsOrder" | "targetTitle" | "summary" | "bulletSelection">> = {};
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
  if (bulletSelection !== undefined) {
    setFields.bulletSelection = bulletSelection;
    saved.push("bulletSelection");
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
