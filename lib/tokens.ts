/**
 * Shared design tokens for the CV. Both the on-screen editor (Tailwind
 * arbitrary values, in mm/pt — physical CSS units) and the PDF document
 * (@react-pdf/renderer, unitless numbers = pt) read from here, so a value
 * changed once stays in sync everywhere. Colors are duplicated into
 * app/globals.css's `@theme` block (CSS can't import a TS module) — keep
 * the two in sync if you change them.
 */

export const COLORS = {
  navy: "#0B1F33",
  amber: "#C77D2E",
  body: "#222222",
  greyDark: "#444444",
  greyLight: "#777777",
} as const;

export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 12,
} as const;

export const PHOTO_SIZE_MM = 24;

/** Point sizes — used verbatim as `fontSize` in react-pdf and as `text-[Npt]` on the web. */
export const FONT_SIZE = {
  name: 22,
  title: 12.5,
  contact: 9.5,
  sectionHeader: 12,
  roleTitle: 11,
  companyLine: 10,
  degree: 11,
  body: 10,
  small: 9,
} as const;

/**
 * mm spacing — used as `mm` CSS units on the web and converted via
 * mmToPt() for react-pdf. Values below (sectionGapTop, entryGapTop,
 * bulletGap, sectionHeaderGapBottom) were reverse-measured from the
 * reference PDF's line pitch (pixel-scanned at 150dpi), not guessed —
 * the reference packs entries much tighter than a first pass suggested.
 */
export const SPACING_MM = {
  photoGap: 6,
  dividerMarginTop: 3,
  dividerMarginBottom: 4,
  sectionGapTop: 1,
  sectionHeaderGapBottom: 1,
  entryGapTop: 1.2,
  bulletGap: 0.5,
  lineGap: 1.2,
} as const;

/** Line height multiplier for body/bullet/paragraph text — measured from the reference: 10pt body text has a 12pt (150dpi: 25px) line pitch. */
export const LINE_HEIGHT = 1.2;

export const DIVIDER_THICKNESS_PT = 1.2;

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}
