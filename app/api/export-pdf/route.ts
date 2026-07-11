import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { CVDocument } from "@/components/CVDocument";
import { cvDataSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { parseJsonBody } from "@/lib/api-errors";
import { countPdfPages } from "@/lib/pdf";
import type { CvData } from "@/lib/cv-data";

export const runtime = "nodejs";

async function resolvePhotoSrc(): Promise<Buffer> {
  const filePath = path.join(process.cwd(), "public", "photo.jpg");
  try {
    return await readFile(filePath);
  } catch (err) {
    throw new Error(
      `Required photo asset not found at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function renderPdf(data: CvData, photoSrc: Buffer, scale: number): Promise<Buffer> {
  // renderToBuffer's type demands a literal <Document> element; CVDocument
  // is a wrapper component that renders one, so the element shape matches
  // at runtime but not nominally — cast at this single boundary.
  const element = React.createElement(CVDocument, { data, photoSrc, scale }) as unknown as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

/**
 * One A4 page is a hard requirement, not best-effort (see DOCS.md §6).
 * Renders at scale 1 first — pixel-identical to CVPreview.tsx's on-screen
 * rendering. If that overflows to more than one page, re-renders at
 * progressively smaller scales (see CVDocument.tsx's `scale` prop, which
 * shrinks fonts/spacing/photo together, not the page margin) until it fits
 * or MIN_SCALE (an 8pt body-text floor: FONT_SIZE.body is 10pt, so 0.8 * 10
 * = 8) is reached, whichever comes first.
 */
const MIN_SCALE = 0.8;
const SCALE_STEP = 0.02;

async function fitToOnePage(data: CvData, photoSrc: Buffer): Promise<{ buffer: Buffer; scale: number; pages: number }> {
  let scale = 1;
  let buffer = await renderPdf(data, photoSrc, scale);
  let pages = countPdfPages(buffer);

  while (pages > 1 && scale > MIN_SCALE) {
    scale = Math.max(MIN_SCALE, Math.round((scale - SCALE_STEP) * 100) / 100);
    buffer = await renderPdf(data, photoSrc, scale);
    pages = countPdfPages(buffer);
  }

  return { buffer, scale, pages };
}

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = cvDataSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const photoSrc = await resolvePhotoSrc();

  const { buffer, scale, pages } = await fitToOnePage(data, photoSrc);
  if (pages > 1) {
    // Every currently-seeded positioning fits within MIN_SCALE (verified
    // empirically — see DOCS.md §6); this only fires for content that
    // genuinely exceeds what an 8pt-floor A4 page can hold. Ships the PDF
    // anyway (better than a hard failure) but flags it loudly server-side.
    console.warn(
      `Export for "${data.name}" still spans ${pages} pages at the minimum scale (${scale}) — content exceeds what fits on one A4 page even at the 8pt readability floor.`,
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(data.name)}-cv.pdf"`,
      "Content-Length": String(buffer.length),
      "X-Cv-Pdf-Scale": String(scale),
      "X-Cv-Pdf-Pages": String(pages),
    },
  });
}
