import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseJsonBody } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const password = typeof body === "object" && body !== null ? (body as { password?: unknown }).password : undefined;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Missing password." }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Server is missing ADMIN_PASSWORD configuration." }, { status: 500 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ isLoggedIn: true });
}
