import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
}

const defaultSession: SessionData = { isLoggedIn: false };

function getSessionSecret(): string {
  const secret = process.env.IRON_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("IRON_SESSION_SECRET is missing or too short (must be at least 32 characters). See .env.example.");
  }
  return secret;
}

const sessionOptions: SessionOptions = {
  cookieName: "cv_session",
  get password() {
    return getSessionSecret();
  },
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (session.isLoggedIn === undefined) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }
  return session;
}
