import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { CVDocument } from "@/components/CVDocument";
import { cvDataSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

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

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cvDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const photoSrc = await resolvePhotoSrc();

  // renderToBuffer's type demands a literal <Document> element; CVDocument
  // is a wrapper component that renders one, so the element shape matches
  // at runtime but not nominally — cast at this single boundary.
  const element = React.createElement(CVDocument, { data, photoSrc }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(data.name)}-cv.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}
