import type { ZodError } from "zod";

/**
 * Turns a ZodError into the flat {path, message}[] shape both the server
 * (lib/api-errors.ts's zodErrorResponse) and the client (the JSON editor on
 * app/admin/edit/[positioningId]/page.tsx) render identically. Pulled out on
 * its own, isomorphic module — unlike lib/api-errors.ts, this one doesn't
 * import next/server, so it's safe to import from client components too.
 */
export interface ZodIssueLike {
  path: string;
  message: string;
}

export function zodIssues(error: ZodError): ZodIssueLike[] {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}
