import type { CvData } from "@/lib/cv-data";
import { slugify } from "@/lib/utils";

/**
 * Browser-side helpers for the "export this positioning as a PDF" flow.
 *
 * The same three steps — fetch the assembled CV, POST it to /api/export-pdf,
 * hand the resulting blob to the browser as a download — were previously
 * copy-pasted verbatim into all three pages that offer an export button
 * (the public Home page, the job-offer generator, and the admin editor).
 * They live here once so a change to the export contract (a new header, a
 * different filename rule, an extra error case) can't be applied to two of
 * the three and missed on the last.
 *
 * Client-only: both functions touch `fetch` plus `URL`/`document`, so they
 * must be called from an event handler in a "use client" component, never
 * from a server component or route handler.
 */

/**
 * Fetches the freshly-assembled CV for a positioning and renders it to a PDF.
 *
 * The CV is re-fetched here rather than reusing whatever the page already has
 * on screen, so an export always reflects what is currently in MongoDB — the
 * admin editor in particular can hold unsaved edits in local state, and
 * exporting those would produce a PDF that doesn't match the saved document.
 *
 * @param positioningId The positioning document's `_id`, e.g. "after_sales_manager_en".
 * @returns The rendered PDF blob, plus the CvData it was rendered from (the
 *   caller needs `name` to build the filename, and would otherwise have to
 *   fetch it a second time).
 * @throws Error with a human-readable message if either request fails.
 */
export async function renderCvPdf(positioningId: string): Promise<{ blob: Blob; data: CvData }> {
  const cvResponse = await fetch(`/api/cv/${positioningId}`);
  if (!cvResponse.ok) throw new Error(`Failed to load CV (${cvResponse.status})`);
  const data = (await cvResponse.json()) as CvData;

  const exportResponse = await fetch("/api/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!exportResponse.ok) throw new Error(`PDF generation failed (${exportResponse.status})`);

  return { blob: await exportResponse.blob(), data };
}

/**
 * Renders a positioning's PDF and saves it to the visitor's downloads.
 *
 * Uses the click-a-temporary-anchor trick because there is no browser API to
 * save a blob directly; the object URL is revoked immediately afterwards so
 * the blob isn't pinned in memory for the life of the page.
 *
 * @param positioningId The positioning document's `_id`.
 */
export async function downloadCvPdf(positioningId: string): Promise<void> {
  const { blob, data } = await renderCvPdf(positioningId);

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${slugify(data.name)}-cv.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
