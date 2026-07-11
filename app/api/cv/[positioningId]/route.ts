import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assemble } from "@/lib/assemble";
import { getProfile } from "@/lib/profile";
import type { PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ positioningId: string }> },
) {
  const { positioningId } = await params;
  const db = await getDb();

  // getProfile() throws on not-found rather than returning null; caught here
  // (not centrally) so this route keeps its own 404 message, run in parallel
  // with the positioning lookup exactly as before.
  const [profileResult, positioning] = await Promise.all([
    getProfile(db).catch((err: unknown) => err as Error),
    db.collection<PositioningDoc>("positionings").findOne({ _id: positioningId }),
  ]);

  if (!positioning) {
    return NextResponse.json({ error: `Positioning "${positioningId}" not found` }, { status: 404 });
  }
  if (profileResult instanceof Error) {
    return NextResponse.json({ error: "Profile document not found" }, { status: 404 });
  }

  const cvData = assemble(profileResult, positioning);
  return NextResponse.json(cvData);
}
