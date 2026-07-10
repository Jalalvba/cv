import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assemble } from "@/lib/assemble";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ positioningId: string }> },
) {
  const { positioningId } = await params;
  const db = await getDb();

  const [profile, positioning] = await Promise.all([
    db.collection<ProfileDoc>("profile").findOne({ _id: "jalal_chafiq" }),
    db.collection<PositioningDoc>("positionings").findOne({ _id: positioningId }),
  ]);

  if (!positioning) {
    return NextResponse.json({ error: `Positioning "${positioningId}" not found` }, { status: 404 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile document not found" }, { status: 404 });
  }

  const cvData = assemble(profile, positioning);
  return NextResponse.json(cvData);
}
