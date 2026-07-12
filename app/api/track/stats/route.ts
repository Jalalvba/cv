import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

interface EmailOpenDoc {
  id: string;
  timestamp: Date;
  userAgent: string;
  ip: string;
}

export async function GET(request: NextRequest) {
  const statsSecret = process.env.TRACKING_STATS_SECRET;
  if (!statsSecret) {
    return NextResponse.json({ error: "Server is missing TRACKING_STATS_SECRET configuration." }, { status: 500 });
  }

  const providedKey = request.headers.get("x-tracking-secret") ?? request.nextUrl.searchParams.get("key");
  if (providedKey !== statsSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 });
  }

  const db = await getDb();
  const hits = await db
    .collection<EmailOpenDoc>("email_opens")
    .find({ id })
    .sort({ timestamp: 1 })
    .toArray();

  const opens = hits.map((hit) => hit.timestamp);

  return NextResponse.json({
    id,
    openCount: opens.length,
    firstOpened: opens[0] ?? null,
    lastOpened: opens[opens.length - 1] ?? null,
    opens,
  });
}
