import { google, Auth } from "googleapis";

/**
 * Google service-account auth helper. Dev tooling only — used by
 * scripts/test-google-service-account.ts, not imported by any app/ route.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

/**
 * Reads and decodes the service account key lazily, at call time — not at
 * module import time — so a missing/invalid env var only breaks the code
 * path that actually needs Google access, instead of crashing the whole
 * app on cold start (e.g. if this module is imported by something that
 * doesn't actually call this function on a given request).
 */
export function getGoogleAuth(): Auth.GoogleAuth {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!keyB64) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_KEY_B64 environment variable. Base64-encode your Google service account JSON key (cat key.json | base64 -w0) and set it in .env.local.",
    );
  }

  let credentials: Auth.JWTInput;
  try {
    credentials = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));
  } catch (err) {
    throw new Error(
      `Failed to decode/parse GOOGLE_SERVICE_ACCOUNT_KEY_B64 as base64-encoded JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}
