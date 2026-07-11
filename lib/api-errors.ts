import { NextResponse } from "next/server";
import type { ZodSafeParseError } from "zod";

/**
 * Shared request-handling helpers for the /api/* route handlers — consolidates
 * what used to be independently copy-pasted per route: turning a thrown
 * error into a message string, parsing a JSON body with a consistent 400 on
 * failure, and turning a failed zod safeParse() into a consistent
 * {error, issues} response.
 */

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Parses a request body as JSON. On failure, returns a ready-to-return 400
 * NextResponse instead of throwing, so callers can `if (!parsed.ok) return
 * parsed.response;`.
 *
 * By default the response body is the generic "Invalid JSON body." (the
 * message four of the five original call sites converged on independently).
 * Pass `includeParseDetail: true` to append the underlying SyntaxError text
 * instead — seed-positioning is the one caller that opts into this, since
 * that route accepts a hand-pasted JSON blob and the raw parser message
 * (e.g. "Unexpected token … in JSON at position …") is genuinely useful for
 * finding a typo in a large paste, unlike the other four routes' small,
 * program-generated request bodies.
 */
export async function parseJsonBody<T>(
  request: Request,
  opts?: { includeParseDetail?: boolean },
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = opts?.includeParseDetail ? `Invalid JSON body: ${errorMessage(err)}` : "Invalid JSON body.";
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) };
  }
}

/**
 * Turns a failed zod safeParse() result into a consistent 400 response:
 * `{ error: string, issues: {path, message}[] }`. `issues` always lists
 * every failing field, in case a caller wants to render them all (see
 * app/admin/positionings/page.tsx's issue list).
 *
 * `opts.prefix` reproduces seed-positioning's original per-item context
 * (e.g. `Validation failed for item 0 (after_sales_manager_en)`) by
 * prepending it to the first issue's path/message — without it, `error` is
 * just the first issue's own message, matching the plainer update-profile /
 * update-positioning behavior.
 */
export function zodErrorResponse<T>(result: ZodSafeParseError<T>, opts?: { prefix?: string }): NextResponse {
  const issues = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const first = issues[0];
  const error = opts?.prefix
    ? `${opts.prefix}: ${first?.path || "(root)"} — ${first?.message}`
    : (first?.message ?? "Validation failed");
  return NextResponse.json({ error, issues }, { status: 400 });
}
