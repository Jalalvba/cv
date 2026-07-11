/**
 * Counts pages in a PDF buffer by counting page object dictionaries
 * (`/Type /Page`, deliberately not matching the parent `/Type /Pages` tree
 * node via the `[^s]` after "Page"). Verified against @react-pdf/renderer's
 * actual output structure and cross-checked against `pdfinfo` — reliable
 * for this app's simple, non-adversarial PDF output. Used by
 * app/api/export-pdf/route.ts's fit-to-one-page search.
 */
export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}
