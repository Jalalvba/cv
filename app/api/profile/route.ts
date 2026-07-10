import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ProfileDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDb();
  const profile = await db.collection<ProfileDoc>("profile").findOne({ _id: "jalal_chafiq" });
  if (!profile) {
    return NextResponse.json({ error: 'Profile document not found (_id: "jalal_chafiq").' }, { status: 404 });
  }
  return NextResponse.json(profile);
}
