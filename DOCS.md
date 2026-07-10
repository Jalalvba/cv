# Jalal Chafiq — CV Project — Documentation

Single source of truth for this project: agent-specific operating rules (§1), how to get it running (§2), and the full architecture / data model / design documentation (§3 onward). `README.md` is the short pointer GitHub renders on the repo page; `AGENTS.md` and `CLAUDE.md` both redirect here for agent-instruction discovery.

---

## 1. Agent Instructions

<!-- BEGIN:nextjs-agent-rules -->
### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 2. Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in MONGODB_URI — see §10 Environment variables
pnpm run db:seed             # pushes profile + positionings from scripts/seed.ts into Atlas
pnpm run dev
```

Open http://localhost:3000.

## 3. What this is

A CV generator for Jalal Chafiq (Mechanical Engineer, PhD, Technical Manager in Automotive After-Sales & Fleet Management) with **pixel-faithful PDF export**. Instead of hand-editing content in a browser, you pick a **positioning** (e.g. "after_sales_manager", "technical_trainer", "fleet_management") — a named lens onto a fixed set of underlying facts — and the app assembles the matching CV from MongoDB, then renders it to a PDF that looks exactly like the reference design, not a browser-print approximation.

The underlying facts (roles, dates, every bullet ever written, education, skills) live once in a `profile` document. Each `positioning` document is a *selection and framing* of that same material — which bullets to surface per role, which skills to lead with, what summary paragraph to use, what target title to display — never a duplicate copy of the text. This replaces the earlier contentEditable, no-persistence editor: content is now authored once in MongoDB and reused across every tailored version, instead of retyped per application.

## 4. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) |
| Database | MongoDB Atlas — `cv` database, `profile` and `positionings` collections |
| PDF generation | `@react-pdf/renderer` (server-side, via a Route Handler) |
| Validation | zod |
| Package manager | pnpm (always) |
| Fonts | Inter (web preview, via `next/font/google`) / Helvetica, Helvetica-Bold, Helvetica-Oblique (PDF — the standard PDF base-14 fonts, no font files needed) |

Dependency health: `pnpm audit` reports **no known vulnerabilities**. One transitive issue was found and fixed during setup — `next@16.2.10` pins a vulnerable `postcss@8.4.31` (moderate XSS advisory) while Tailwind's own postcss dependency was already patched at `8.5.16`. Fixed with a `pnpm.overrides.postcss: "^8.5.10"` pin in `package.json`, which dedupes the whole tree to the patched version. Re-check whether this override is still needed if Next is ever upgraded — the advisory may be fixed upstream by then.

## 5. Repository layout

```
CV/
├── app/                      the actual Next.js app
│   ├── page.tsx              positioning picker + generated CV preview + Export PDF button
│   ├── layout.tsx            fonts (Inter), metadata
│   ├── globals.css           Tailwind theme tokens
│   └── api/
│       ├── positionings/route.ts     GET — list available positioning _ids + targetTitles
│       ├── cv/[positioningId]/route.ts  GET — assembled CvData for one positioning (profile + positioning merge)
│       └── export-pdf/route.ts       POST — generates the PDF from an assembled CvData payload
├── components/
│   ├── PositioningPicker.tsx  select which positioning to preview/export
│   ├── CVPreview.tsx          read-only on-screen rendering of the assembled CV
│   └── CVDocument.tsx         the @react-pdf/renderer document (PDF layout)
├── lib/
│   ├── db.ts                  MongoDB client singleton (cached across hot reloads in dev)
│   ├── cv-data.ts             CvData, ProfileDoc, PositioningDoc types
│   ├── assemble.ts            merges a ProfileDoc + PositioningDoc into one CvData for rendering
│   ├── tokens.ts              shared design tokens (colors, mm/pt spacing) — THE source of truth
│   └── validation.ts          zod schemas: ProfileDoc, PositioningDoc, export-route request body
├── scripts/
│   └── seed.ts                one-off script: pushes the profile + positioning JSON into MongoDB Atlas
├── public/photo.jpg           the profile photo (600×600, cropped from template/photo.png)
├── template/                  REFERENCE MATERIAL ONLY — not part of the app
│   ├── CV_Jalal_Chafiq_RMA.pdf         reference CV (French, RMA-tailored)
│   ├── CV_Jalal_Chafiq_Stellantis.pdf  reference CV (English, generic) — original content source
│   ├── CV de jalal chafiq (1) (1).pdf  older jsPDF-generated CV (different layout — not a design reference)
│   └── photo.png              original uncropped photo
├── DOCS.md                    single source of truth (this file)
├── AGENTS.md                  agent-instructions pointer → DOCS.md §1
├── CLAUDE.md                  imports DOCS.md
└── README.md                  short pointer / GitHub landing page
```

`template/` is excluded from TypeScript checking (`tsconfig.json` → `exclude`) and is not touched by `next build` — it's reference material only, sitting alongside the live project. Earlier archived versions of this project (a static HTML/CSS/JS build, an earlier Next.js+MongoDB rebuild, and the contentEditable no-persistence editor) have been deleted outright rather than kept as in-repo archives — this section is the only remaining record of what they were.

### Why the contentEditable editor was replaced

The original brief was a single, hand-edited CV with no persistence — refreshing reset to defaults by design. That stopped matching the actual use case once the project scaled to multiple tailored applications (RMA, Stellantis, Dunasys, and future offers): the same underlying facts kept getting retyped and re-worded per application, with no shared source of truth, which is exactly how a "New bullet point" placeholder once shipped into a real PDF. The `profile` / `positionings` split fixes that structurally — every bullet exists exactly once, tagged, and is only ever *referenced* by id from a positioning, never duplicated.

## 6. Design tokens — how they were derived

Unchanged from the original build — this section documents the visual design, not the data layer.

The brief specified design tokens said to come from "an existing PDF." That PDF (plus two siblings) turned out to already be sitting in what's now `template/`. Rather than trust the numbers as given, they were **pixel-sampled directly from the reference PDFs** (rendered at 150dpi via `pdftoppm`, sampled with PIL) to confirm exact values and reverse-engineer the ones that weren't specified (line pitch, section spacing).

Confirmed by pixel sampling:
- Navy `#0B1F33` — exact match, used for name, section headers, role/degree titles
- Amber `#C77D2E` — exact match, used for the header subtitle, the divider line, and the italic company/dates line in each experience entry
- Body text `#222222` — exact match, used for paragraphs, bullets, skills, languages
- Grey `#444444` — exact match, used for the contact line and the education institution/year line
- Font: `pdffonts` on the reference PDF confirmed literal `Helvetica` / `Helvetica-Bold` / `Helvetica-Oblique` — the PDF standard-14 fonts, so the exported PDF embeds no font files at all and is guaranteed to render identically everywhere

Reverse-measured from the reference's line pitch:
- Body text line pitch: 25px at 150dpi = 12pt = 10pt font × **1.2** line-height
- Section-to-section and entry-to-entry gaps are much tighter than a first-pass guess — see `lib/tokens.ts` `SPACING_MM` for the final measured values

All of this lives in **`lib/tokens.ts`**, the single source of truth:

```ts
COLORS         // navy, amber, body, greyDark, greyLight
PAGE           // A4 210×297mm, 18mm margins (18mm was also confirmed by pixel-measuring the reference's photo position)
PHOTO_SIZE_MM  // 24 — the photo is a 24mm square
FONT_SIZE      // pt sizes: name 22, title 12.5, sectionHeader 12, roleTitle 11, degree 11, body/companyLine 10, contact 9.5, small 9
SPACING_MM     // mm gaps: photoGap 6, dividerMarginTop/Bottom 3/4, sectionGapTop 1, sectionHeaderGapBottom 1, entryGapTop 1.2, bulletGap 0.5
LINE_HEIGHT    // 1.2
DIVIDER_THICKNESS_PT  // 1.2
mmToPt()       // conversion helper
```

### Keeping the web preview and PDF pixel-identical

`components/CVPreview.tsx` (the web view) and `components/CVDocument.tsx` (the PDF) are built from the **same numbers** in `lib/tokens.ts`, expressed as **physical CSS units**:

- The web sheet is `w-[210mm] min-h-[297mm] p-[18mm]` — real millimeters, not an approximation. A 24mm photo (`h-[24mm] w-[24mm]`) is the literal physical size it'll be in print.
- Font sizes are Tailwind arbitrary values in points (`text-[11pt]`), the same unit react-pdf uses natively.
- `CVDocument.tsx` imports `lib/tokens.ts` directly (plain TS, no build-step issue).
- `CVPreview.tsx` **cannot** import `lib/tokens.ts` values into Tailwind class strings — Tailwind's JIT compiler needs literal static strings at build time, not runtime-interpolated ones. So the mm/pt literals are hand-copied into the JSX class names. **If you change a value in `lib/tokens.ts`, you must also update the matching literal in `CVPreview.tsx`** (and in `app/globals.css`'s `@theme` block for colors — CSS can't import a TS module either). Each of these spots has a comment pointing back to `tokens.ts`.

Net effect: what you see on screen at `w-[210mm]` is the same physical size as the exported A4 PDF, not just a similar-looking layout.

## 7. Data model

### 7.1 `profile` collection — one document, the underlying facts

```ts
interface ProfileDoc {
  _id: "jalal_chafiq";
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    languages: { lang: string; level: string }[];
  };
  education: {
    id: string;
    degree: string;
    school: string;
    endDate: string;
    honors?: string;
    tags: string[];
  }[];
  experience: {
    id: string;              // e.g. "exp_avis"
    title: string;
    company: string;
    location: string;
    startDate: string;       // "2025-07"
    endDate: string | null;  // null = current
    bullets: {
      id: string;            // e.g. "avis_b1"
      text: string;
      textFr?: string;       // French translation of `text`; see the fallback/warn behavior below
      tags: string[];        // e.g. ["ops", "customer_care", "fleet"]
    }[];
  }[];
}
```

Every bullet currently in `profile` has a `textFr` set, but the field is optional in the schema because new bullets can be added in English first and translated later; `assemble()` handles that gap explicitly rather than assuming it can't happen.

### 7.2 `positionings` collection — one document per CV variant

```ts
interface PositioningDoc {
  _id: string;                // e.g. "after_sales_manager", "technical_trainer_fr"
  targetTitle: string;        // headline shown under the name
  summary: string;            // professional summary, specific to this positioning
  skillsOrder: string[];      // flat list, rendered as a "•"-joined line, in this exact order
  bulletSelection: {
    [experienceId: string]: string[]; // which bullet ids to surface for that role; omit a role entirely to drop it from this CV
  };
  format: "visual" | "ats";   // visual = photo/navy/amber design; ats = single-column plain layout
  language: "en" | "fr";      // selects targetTitle/summary/skillsOrder (already language-specific per document) and, via assemble(), which bullet field (text vs. textFr) is rendered
  draftTranslation?: boolean; // true = machine-translated, not yet human-reviewed; absent/false = validated content. Purely a review-status flag — doesn't affect rendering or assemble() behavior.
}
```

Current positioning `_id`s and language:

| `_id` | `language` | `draftTranslation` |
|---|---|---|
| `after_sales_manager` | en | — |
| `technical_trainer` | en | — |
| `fleet_management` | en | — |
| `after_sales_manager_fr` | fr | — (verbatim from the reference French CV, `template/CV_Jalal_Chafiq_RMA.pdf`) |
| `technical_trainer_fr` | fr | `true` — drafted by translating the English version, not yet human-reviewed |
| `fleet_management_fr` | fr | `true` — drafted by translating the English version, not yet human-reviewed |

A Dunasys positioning is referenced in passing in §5 (as one of the applications that motivated the `profile`/`positionings` split) but no such document has ever actually been seeded — there's no `dunasys` or `dunasys_fr` `_id` in `scripts/seed.ts`, no reference material for it in `template/`, and no prior git history to recover it from (this repo has no commits predating this documentation). Treat any mention of a Dunasys CV as historical color, not an existing positioning, until one is actually created.

### 7.3 Assembled `CvData` — what actually gets rendered (`lib/assemble.ts`)

```ts
interface CvData {
  photoUrl: string;
  name: string;
  title: string;              // = positioning.targetTitle
  contact: { email: string; phone: string; location: string };
  summary: string;            // = positioning.summary
  experience: {
    id: string; title: string; company: string; dates: string;
    bullets: string[];        // resolved text, filtered + ordered per positioning.bulletSelection
  }[];
  education: ProfileDoc["education"]; // currently unfiltered — every positioning shows full education
  skills: string[];           // = positioning.skillsOrder
  languages: ProfileDoc["personal"]["languages"];
}
```

`assemble(profile, positioning)` does the merge: for each `experience` entry in `profile`, look up `positioning.bulletSelection[exp.id]`; if present, keep only those bullet ids in that order; if absent, include all of that role's bullets by default. Role exclusion (dropping a role entirely for a given positioning) is not yet implemented — see §13.

For each selected bullet's text, `assemble()` picks `text` or `textFr` based on `positioning.language`: an `"en"` positioning always uses `text`; an `"fr"` positioning uses `textFr` if present, and otherwise **falls back to `text` and calls `console.warn()` naming the bullet id** — a missing translation degrades to English content rather than failing the request, but is never silent.

## 8. How generation actually works

1. `app/page.tsx` calls `GET /api/positionings` on load, populates `PositioningPicker.tsx` with the available `_id` / `targetTitle` pairs.
2. Selecting a positioning triggers `GET /api/cv/[positioningId]`, which fetches both the single `profile` document and the matching `positionings` document from MongoDB Atlas, runs `assemble()`, and returns the resulting `CvData`.
3. `CVPreview.tsx` renders that `CvData` read-only on screen at physical `w-[210mm]` size (see §6).
4. Clicking "Export PDF" does `POST /api/export-pdf` with the same `CvData` payload.
5. The route validates the body against `lib/validation.ts`, resolves `photoUrl` (a `/photo.jpg` web path) to an actual file `Buffer` by reading from `public/` — a web path isn't a valid image source for a Node-side PDF render, so this conversion happens in the route, not in `CVDocument.tsx` (which stays a pure, environment-agnostic component and accepts an optional `photoSrc` override prop for exactly this purpose).
6. `renderToBuffer()` (from `@react-pdf/renderer`) renders `<CVDocument data={...} photoSrc={...} />` to a PDF buffer, server-side.
7. Response is returned with `Content-Type: application/pdf` and a `Content-Disposition: attachment` header with a slugified filename (`lib/utils.ts`'s `slugify()`, based on `positioning._id`).
8. Client turns the response `Blob` into an object URL and triggers a download via a temporary `<a download>` click — no `window.print()`, no CSS print media queries anywhere in this project.

The export route runs with `export const runtime = "nodejs"` — required, since `@react-pdf/renderer` isn't Edge-compatible. The `cv/[positioningId]` and `positionings` routes can run on Edge if desired (plain MongoDB reads, no PDF work) but currently share the Node.js runtime for simplicity.

One TypeScript wrinkle worth knowing about: `renderToBuffer()`'s type signature demands a literal `React.ReactElement<DocumentProps>` (i.e. an actual `<Document>` element), but `CVDocument` is a wrapper component around one. The element shape matches at runtime but not nominally, so there's a single, explicitly-commented cast at that boundary in `route.ts` — not a systemic `any`-everywhere workaround.

## 9. Editing content

There is no in-browser content editor anymore. To change what appears on any CV:

- **New bullet, new role, new education entry, corrected fact**: edit the `profile` document directly in MongoDB Atlas (via the Atlas UI, `mongosh`, or by editing `scripts/seed.ts` and re-running it — re-running the seed script upserts by `_id`, it does not duplicate).
- **New CV variant, retarget an existing one, reorder skills, rewrite the summary for one application**: edit or add a `positionings` document the same way.
- **New offer that doesn't fit an existing positioning**: add a new `PositioningDoc` with a fresh `_id`, referencing existing bullet ids from `profile` — no new prose needs writing unless the offer genuinely needs a bullet that's never been said before, in which case that bullet is added once to the relevant role in `profile` and tagged, then referenced.

`scripts/seed.ts` is the recommended path for anything beyond a one-line tweak, since it's versioned in the repo (unlike ad hoc Atlas UI edits) and re-running it is idempotent.

## 10. Deployment

### Environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string, `cv` database. Never hardcoded — see `.env.example` for the placeholder format, and confirm `.env.local` is in `.gitignore`. |

### Deploying to Vercel

Import the repo or run `vercel` from this directory — Vercel detects `pnpm-lock.yaml` and uses pnpm automatically. Two requirements beyond the original no-database setup:

- Add `MONGODB_URI` in the Vercel project's Environment Variables (Production + Preview) — pointing at the same Atlas cluster, or a separate one if you want preview deployments isolated from production data.
- `/api/export-pdf` must run on the Node.js runtime (already set via `export const runtime = "nodejs"`), not Edge.

## 11. Scripts

- `pnpm run dev` — dev server
- `pnpm run build` — production build
- `pnpm run start` — run the production build locally
- `pnpm run lint` — ESLint
- `pnpm run db:seed` — runs `scripts/seed.ts`, upserting `profile` and all `positionings` documents into MongoDB Atlas

## 12. Verification performed (not just typechecked)

Carried over from the original build (still true, unaffected by the data-layer change):
- `tsc --noEmit`, `eslint`, `next build`, `pnpm audit` all pass clean
- Rendered the exported PDF to images (`pdftoppm`) and visually compared against the reference PDFs — matched closely enough that a side-by-side is hard to tell apart

Re-verified after the MongoDB migration (against a temporary local `mongod`, seeded via `scripts/seed.ts`):
- [x] Confirmed `GET /api/positionings` returns all seeded documents
- [x] Confirmed `GET /api/cv/[positioningId]` correctly filters bullets per `bulletSelection` and falls back to "all bullets" when a role is omitted from the selection (verified against real seeded data, not just the unit test — e.g. `exp_dekra` is omitted from `after_sales_manager`'s `bulletSelection` and correctly renders all 3 of its bullets)
- [x] Confirmed the export PDF for `after_sales_manager` (`visual`) and `technical_trainer` (`ats`) both render and visually match the reference design at 150dpi via `pdftoppm`
- [x] Confirmed `scripts/seed.ts` is idempotent — ran it twice, `profile` and `positionings` collection counts stayed at 1 and 3 respectively
- [x] Confirmed `GET /api/cv/<unknown-id>` returns 404

## 13. Known gaps / possible future work

- **Pagination**: unchanged from the original build — page breaks fall only between whole entries (`wrap={false}`), never mid-bullet. A positioning with a lot of included bullets across all four roles may still export to 2 pages; matching the reference's exact 1-page density for arbitrary content would require smaller type or tighter margins than the reference itself uses, which would start to visually diverge from the "exact design" brief.
- **No role exclusion yet**: `assemble()` currently always includes every role from `profile.experience`; a positioning can only filter *which bullets* appear per role, not drop a role entirely (e.g. hiding DEKRA for a positioning where it's irrelevant). Documented as a real limitation in §7.3, not yet built.
- **No versioning/audit trail**: editing `profile` or a `positioning` in Atlas overwrites in place; there's no history of what a given exported PDF actually contained at the time it was sent to a given employer. Worth adding if this matters later (e.g. a `sentAt` / `snapshot` field on export).
- **No auth**: the app has no login. Anyone with the deployed URL can view/export any positioning. Acceptable for a single-user personal tool, not acceptable if this is ever shared or made public.
- **No photo upload UI**: unchanged — the photo is a fixed asset (`public/photo.jpg`); swapping it means replacing that file directly.
