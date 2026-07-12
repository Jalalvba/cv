import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Smallest valid transparent GIF (1x1, GIF89a) — served regardless of the
 * MongoDB write outcome below, since this loads as an <img> in emails and
 * must never break rendering or visibly fail.
 */
const TRANSPARENT_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

const GIF_RESPONSE_INIT = {
  status: 200,
  headers: {
    "Content-Type": "image/gif",
    "Content-Length": String(TRANSPARENT_GIF.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
};

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    // Best-effort logging — a DB failure must never surface as a broken
    // pixel, so errors are swallowed here rather than propagated.
    try {
      const db = await getDb();
      await db.collection("email_opens").insertOne({
        id,
        timestamp: new Date(),
        userAgent: request.headers.get("user-agent") ?? "unknown",
        ip: getClientIp(request),
      });
    } catch (err) {
      console.error("Failed to log email open:", err);
    }
  }

  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), GIF_RESPONSE_INIT);
}
