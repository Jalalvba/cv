import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { positioningDocSchema } from "@/lib/validation";
import { requireAdminSession } from "@/lib/admin-auth";
import type { PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const rawText = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return NextResponse.json({ error: `Invalid JSON: ${errorMessage(err)}` }, { status: 400 });
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) {
    return NextResponse.json({ error: "No positioning documents provided." }, { status: 400 });
  }

  const validated: PositioningDoc[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = positioningDocSchema.safeParse(item);
    if (!result.success) {
      const itemId = item && typeof item === "object" && "_id" in item ? String((item as { _id: unknown })._id) : "unknown _id";
      const issues = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      return NextResponse.json(
        {
          error: `Validation failed for item ${i} (${itemId}): ${issues[0].path || "(root)"} — ${issues[0].message}`,
          itemIndex: i,
          issues,
        },
        { status: 400 },
      );
    }
    validated.push(result.data);
  }

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const doc of validated) {
    if (seenIds.has(doc._id)) duplicateIds.add(doc._id);
    seenIds.add(doc._id);
  }
  if (duplicateIds.size > 0) {
    return NextResponse.json(
      { error: `Duplicate _id(s) within this paste: ${Array.from(duplicateIds).join(", ")}` },
      { status: 400 },
    );
  }

  const created: string[] = [];
  const updated: string[] = [];
  try {
    const db = await getDb();
    for (const doc of validated) {
      const result = await db
        .collection<PositioningDoc>("positionings")
        .replaceOne({ _id: doc._id }, doc, { upsert: true });
      if (result.upsertedCount > 0) {
        created.push(doc._id);
      } else {
        updated.push(doc._id);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `MongoDB write failed: ${errorMessage(err)}`, created, updated },
      { status: 500 },
    );
  }

  return NextResponse.json({ created, updated });
}
