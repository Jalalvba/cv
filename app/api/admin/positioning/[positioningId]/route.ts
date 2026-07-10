import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

// Read-only — not gated by requireAdminSession. Same exposure level as GET
// /api/profile and GET /api/positionings (both public reads); only the
// mutating PATCH /api/admin/update-positioning route requires a session.
export async function GET(_request: Request, { params }: { params: Promise<{ positioningId: string }> }) {
  const { positioningId } = await params;
  const db = await getDb();
  const positioning = await db.collection<PositioningDoc>("positionings").findOne({ _id: positioningId });
  if (!positioning) {
    return NextResponse.json({ error: `Positioning "${positioningId}" not found` }, { status: 404 });
  }
  return NextResponse.json(positioning);
}
