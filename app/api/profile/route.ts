import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { errorMessage } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDb();
  try {
    const profile = await getProfile(db);
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 404 });
  }
}
