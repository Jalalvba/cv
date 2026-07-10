import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Shared gate for the /api/admin/* mutation routes — verifies the caller has
 * a valid, logged-in iron-session cookie (see lib/session.ts). Returns a
 * response to send back immediately on failure, or null if the request may
 * proceed.
 */
export async function requireAdminSession(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized: not logged in." }, { status: 401 });
  }
  return null;
}
