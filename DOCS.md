# Jalal Chafiq — CV Project — Documentation

Single source of truth for this project: agent-specific operating rules (§1), how to get it running (§2), architecture and data model (§3 onward). `README.md` is the short pointer GitHub renders on the repo page; `AGENTS.md` and `CLAUDE.md` both redirect here for agent-instruction discovery.

---

## 1. Agent Instructions

<!-- BEGIN:nextjs-agent-rules -->
### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 2. Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in MONGODB_URI, ADMIN_PASSWORD, IRON_SESSION_SECRET — see §9
pnpm run db:seed             # pushes profile + positionings from scripts/seed.ts into Atlas
pnpm run dev
```

Open http://localhost:3000. Log in as Admin (top nav) with `ADMIN_PASSWORD` to edit content.

## 3. What this is

A CV generator for Jalal Chafiq (Mechanical Engineer, PhD, Technical Manager in Automotive After-Sales & Fleet Management) with **pixel-faithful PDF export**. Pick a **positioning** (e.g. `after_sales_manager_en`) — a named lens onto a fixed set of underlying facts — and the app assembles the matching CV from MongoDB, then renders it to a PDF that looks exactly like the original reference design, not a browser-print approximation.

The underlying facts (roles, dates, every bullet ever written, education, skills, personal info) live once in a `profile` document. Each `positioning` document is a *selection and framing* of that same material — which bullets to surface per role, which skills to lead with, what summary/title to use, which language — never a duplicate copy of the text.

The app has two audiences: anyone with the URL can view and export any CV (`/`, public, read-only); only the admin (single password, session-based) can edit content (`/admin/edit/[positioningId]`) or bulk-seed new positionings (`/admin/positionings`). See §8.

## 4. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) |
| Database | MongoDB Atlas — `cv` database, `profile` and `positionings` collections |
| PDF generation | `@react-pdf/renderer` (server-side, via a Route Handler) |
| Auth | `iron-session` — sealed httpOnly cookie, single admin password (see §8.2) |
| Validation | zod |
| Package manager | pnpm (always) |
| Fonts | Inter (web, via `next/font/google`) / Helvetica, Helvetica-Bold, Helvetica-Oblique (PDF — the standard PDF base-14 fonts, no font files needed) |

Dependency health: `pnpm audit` reports no known vulnerabilities as of the last check. `package.json`'s `pnpm.overrides` pins `postcss` (patches a moderate XSS advisory in a transitive `next@16.2.10` dependency) and `google-auth-library`. Re-check whether these overrides are still needed if their parent packages are ever upgraded.

## 5. Repository layout

```
CV/
├── app/
│   ├── page.tsx                     public Home: role/language picker + read-only CV + Export PDF
│   ├── layout.tsx                   root layout — fonts, AuthProvider, TopNav
│   ├── globals.css                  Tailwind theme tokens
│   ├── admin/
│   │   ├── edit/page.tsx            redirects to a default positioning's editor
│   │   ├── edit/[positioningId]/page.tsx   gated full editor (login form if logged out)
│   │   └── positionings/page.tsx    gated bulk JSON paste-and-seed tool
│   └── api/                         see §7 for the full route table
├── components/
│   ├── AdminLoginForm.tsx           password form, used when the admin area is logged out
│   ├── CVDocument.tsx               the @react-pdf/renderer PDF layout
│   ├── CVPreview.tsx                read-only on-screen CV rendering (pixel-matched to CVDocument)
│   ├── RoleLanguageSelector.tsx     role dropdown + FR/EN toggle, used on Home and in the admin editor
│   └── TopNav.tsx                   persistent top nav — Home / Admin links only
├── lib/
│   ├── admin-auth.ts                requireAdminSession() — the gate every /api/admin/* mutation route calls
│   ├── assemble.ts                  merges ProfileDoc + PositioningDoc → CvData
│   ├── assemble.test.ts             plain node:assert tests for assemble() — `pnpm run test`
│   ├── auth-context.tsx             client AuthProvider / useAuth()
│   ├── cv-data.ts                   ProfileDoc, PositioningDoc, CvData — the canonical types
│   ├── db.ts                        MongoDB client singleton
│   ├── google.ts                    Google service-account auth — dev tooling only, not used by the app
│   ├── session.ts                   iron-session config, getSession()
│   ├── tokens.ts                    design tokens (colors, mm/pt spacing) — THE source of truth
│   ├── utils.ts                     slugify()
│   └── validation.ts                zod schemas mirroring cv-data.ts
├── scripts/
│   ├── seed.ts                      upserts profile + all positionings into MongoDB Atlas — `pnpm run db:seed`
│   ├── test-cv-pipeline.ts          fetches live data, runs assemble()+schema validation per positioning
│   └── test-google-service-account.ts   Drive/Sheets connectivity check for GOOGLE_SERVICE_ACCOUNT_KEY_B64
├── public/photo.jpg                 profile photo (600×600)
├── DOCS.md                          single source of truth (this file)
├── AGENTS.md                        agent-instructions pointer → DOCS.md §1
├── CLAUDE.md                        `@DOCS.md` import (Claude Code auto-loads this)
└── README.md                        short pointer / GitHub landing page
```

No `template/` directory anymore — the reference PDFs the design tokens were originally pixel-sampled from have been deleted (never tracked in git, purely historical; the derived values are fully captured in `lib/tokens.ts`, which is what the app actually reads).

## 6. Design tokens

The visual design (navy `#0B1F33`, amber `#C77D2E`, body `#222222`, grey `#444444`/`#777777`; Helvetica/Helvetica-Bold/Helvetica-Oblique; A4 210×297mm with 18mm margins; 24mm square photo; 10pt body text at 1.2 line-height) was originally pixel-sampled from three reference CV PDFs at 150dpi. All of it lives in **`lib/tokens.ts`**, the single source of truth: `COLORS`, `PAGE`, `PHOTO_SIZE_MM`, `FONT_SIZE`, `SPACING_MM`, `LINE_HEIGHT`, `DIVIDER_THICKNESS_PT`, `mmToPt()`.

**Keeping the web preview and PDF pixel-identical:** `components/CVPreview.tsx` (web) and `components/CVDocument.tsx` (PDF) are built from the same `lib/tokens.ts` numbers, expressed as physical CSS units (`w-[210mm]`, `text-[11pt]`, etc.). `CVDocument.tsx` imports `tokens.ts` directly. `CVPreview.tsx` **cannot** — Tailwind's JIT compiler needs literal static class strings, not runtime-interpolated ones — so the mm/pt literals are hand-copied into its JSX. Likewise `app/globals.css`'s `@theme` block hand-copies the colors (CSS can't import a TS module either). **If you change a value in `tokens.ts`, update the matching literal in both `CVPreview.tsx` and `globals.css`.**

## 7. Data model

### 7.1 `profile` collection — one document, the underlying facts

```ts
interface ProfileDoc {
  _id: "jalal_chafiq";
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;        // display string used on the CV's contact line, e.g. "Casablanca, Morocco" — unrelated to `address` below
    address?: {               // structured, separate from `location`; also folded into one formatted line on the CV itself
      street?: string;        // (assemble()'s contact.address, alongside — not deduplicated with — location)
      postalCode?: string;
      city?: string;
      country?: string;
    };
    dateOfBirth?: string;     // "YYYY-MM-DD" — age is computed fresh from this at assemble() time, never stored as a static number
    website?: string;        // bare domain or full URL, e.g. "chafiqjalal.com" — lenient zod validation, see lib/validation.ts
    languages: { lang: string; level: string }[];
  };
  education: {
    id: string;
    degree: string;
    school: string;
    endDate: string;
    honors?: string;
    description?: string;
    descriptionFr?: string;  // French translation of `description`; same fallback pattern as bullets' textFr
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
      textFr?: string;       // French translation of `text`; optional — see the fallback/warn behavior below
      tags: string[];        // e.g. ["ops", "customer_care", "fleet"]
    }[];
  }[];
}
```

`textFr`/`descriptionFr` are optional because new content can be written in English first and translated later; `assemble()` (§7.3) handles that gap explicitly.

### 7.2 `positionings` collection — one document per CV variant

```ts
interface PositioningDoc {
  _id: string;                // "{roleGroup}_{language}", e.g. "after_sales_manager_en"
  roleGroup: string;          // shared across language variants of the same role, e.g. "after_sales_manager"
  targetTitle: string;        // headline shown under the name
  summary: string;            // professional summary, specific to this positioning
  skillsOrder: string[];      // flat list, rendered as a "•"-joined line, in this exact order
  bulletSelection: {
    [experienceId: string]: string[]; // which bullet ids to surface for that role; omit a role entirely to include ALL of that role's bullets by default (there is no way to drop a role entirely — see §10)
  };
  format: "visual" | "ats";   // visual = photo/navy/amber design; ats = single-column plain layout
  language: "en" | "fr";      // selects which of targetTitle/summary/skillsOrder to show, and via assemble(), whether bullets resolve text or textFr
  draftTranslation?: boolean; // true = machine-translated, not yet human-reviewed; absent/false = validated content. Purely a review-status flag.
}
```

`roleGroup` is what `RoleLanguageSelector` groups by — `GET /api/positionings` returns `{ roleGroup, label, variants: { en?, fr? } }[]`, and the FR/EN toggle switches between two documents that share a `roleGroup`.

Currently seeded (`scripts/seed.ts`): `after_sales_manager` (en/fr), `technical_trainer` (en/fr, `ats` format), `fleet_management` (en/fr, `visual` format). Only `fleet_management_fr` is currently flagged `draftTranslation: true`.

### 7.3 Assembled `CvData` — what actually gets rendered (`lib/assemble.ts`)

```ts
interface CvData {
  photoUrl: string;
  name: string;
  title: string;              // = positioning.targetTitle
  contact: { email: string; phone: string; location: string; address?: string; age?: number; website?: string };
  // address = formatted single line from personal.address; age = computed from personal.dateOfBirth — both undefined if the source field is unset
  summary: string;            // = positioning.summary
  experience: {
    id: string; title: string; company: string; dates: string;
    bullets: string[];        // resolved text, filtered + ordered per positioning.bulletSelection
  }[];
  education: Omit<ProfileDoc["education"][number], "descriptionFr">[]; // unfiltered — every positioning shows full education
  skills: string[];           // = positioning.skillsOrder
  languages: ProfileDoc["personal"]["languages"];
}
```

`assemble(profile, positioning)`: for each `experience` entry, look up `positioning.bulletSelection[exp.id]`; if present, keep only those bullet ids in that order; if absent, include all of that role's bullets. For each selected bullet, resolve `text` or `textFr` by `positioning.language` — an `"en"` positioning always uses `text`; an `"fr"` positioning uses `textFr` if present, otherwise **falls back to `text` and calls `console.warn()` naming the bullet id** (degrades gracefully, never silent). `education[].description` resolves the same way via `descriptionFr`. `contact.age` is computed from `personal.dateOfBirth` fresh on every call (never cached/stored, so it can't go stale), and `contact.address` is a single formatted line from `personal.address` — both are `undefined` when the source field is unset. `CVDocument.tsx`/`CVPreview.tsx` join `contact.address` and `contact.age` (as `"{n} years"`) into the CV's contact line alongside `email`/`phone`/`location`/`website` — the two components' join logic must stay in sync (see §6). Produced by `GET /api/cv/[positioningId]`, consumed by both `CVPreview.tsx` (Home) and `CVDocument.tsx` (PDF export).

## 8. Architecture: public Home vs. gated admin

### 8.1 Public Home (`/`, `app/page.tsx`)

Fully read-only, and has **no awareness of login state at all** — it never imports the auth context. Flow: `GET /api/positionings` on load → pick a default role/language → `GET /api/cv/[positioningId]` → render via `CVPreview.tsx`. "Export as PDF" re-fetches the current `CvData` and `POST`s it to `/api/export-pdf`, then triggers a browser download. Switching role/language via `RoleLanguageSelector` just updates local state and re-fetches — no route change.

### 8.2 Auth model (`iron-session`)

Single-admin, password-based — not multi-user, no username.

- `lib/session.ts` — `getSession()` wraps `getIronSession(cookies(), sessionOptions)`. The cookie (`cv_session`) is **sealed and httpOnly, not a JWT** — its contents (`{ isLoggedIn: boolean }`) are opaque to the browser. `IRON_SESSION_SECRET` (32+ chars) is the seal/unseal key; missing or too-short throws immediately.
- `POST /api/auth/login` — checks the posted password against `ADMIN_PASSWORD`, sets `session.isLoggedIn = true`, saves (sets the cookie).
- `POST /api/auth/logout` — `session.destroy()`.
- `GET /api/auth/status` — used on every page load (via `AuthProvider` in `lib/auth-context.tsx`) to decide read-only vs. editable render *before* any click, not just after.
- `lib/admin-auth.ts`'s `requireAdminSession()` — the server-side gate every `/api/admin/*` **mutation** route calls first; returns a 401 `NextResponse` if not logged in, or `null` to let the route proceed. This is what actually matters for security — the client-side `isLoggedIn` checks only control what's rendered, they don't gate the writes.

There is no token-based auth anywhere in this codebase anymore (an earlier `ADMIN_TOKEN`/`x-admin-token` header scheme was fully replaced by the above).

### 8.3 Admin editor (`/admin/edit/[positioningId]`)

Client-gated on `isLoggedIn`: logged out renders **only** `<AdminLoginForm />` — no data fetch happens, no CV content, nothing else on the page. Logged in, it fetches `GET /api/profile` + `GET /api/admin/positioning/[id]` + `GET /api/cv/[id]` and renders a structured, field-by-field form — individual inputs for name/email/phone/location/address/dateOfBirth/website/languages, education entries (with add/remove), each role's bullet selection (add from profile / remove / reorder via `bulletSelection`), and skills (add/remove/reorder). This replaced an earlier raw-JSON-textarea editor; generating positioning JSON externally via an AI assistant is still supported, just via the downloadable context prompt on §8.4 rather than a paste-into-this-page workflow.

"Save changes" diffs the edited `profile`/`positioning` against the last-loaded snapshot (`app/admin/edit/[positioningId]/diff.ts`'s `diffProfile`/`diffPositioning`) and sends only what changed to `PATCH /api/admin/update-profile` / `/api/admin/update-positioning`, validated there against `updateProfileRequestSchema`/`updatePositioningRequestSchema` (see `lib/validation.ts`). Everything the form exposes round-trips this way — including `personal.address`, `personal.languages`, education/bullet `tags`, and structural add/remove of whole education entries or bullet selections. What's still genuinely out of scope for a targeted PATCH (adding/removing a whole experience/role entry, a role's title/company/location/dates, authoring a brand-new bullet's text, or restructuring a positioning's `_id`/`roleGroup`/`format`/`language`/`draftTranslation`) is reported back as "not saved" rather than silently dropped, and still goes through §8.4's full-document replace. "Preview PDF" / "Export & Download" work the same as Home's export, plus there's a "Seed Positionings" link to §8.4 and a "Logout" button.

### 8.4 Bulk seed tool (`/admin/positionings`)

Also gated (client shows disabled fields when logged out; server-side `POST /api/admin/seed-positioning` is gated regardless). A "Download context prompt for external AI" button (`lib/context-prompt.ts`'s `buildContextPromptMarkdown()`) fetches `GET /api/profile` + a real FR/EN `PositioningDoc` example pair (`GET /api/admin/positioning/after_sales_manager_fr` / `after_sales_manager_en`) fresh at click time and assembles one self-contained `.md` file — instructions, the annotated `PositioningDoc` shape, the live positioning example, the annotated `ProfileDoc` shape, the live full profile, then the standing generation rules (bullet-id-only, identical `bulletSelection` across FR/EN, the `format` heuristic, no invented skills for gaps) — meant to be pasted whole into an external AI assistant alongside a job offer. There's no separate on-page schema display; the downloaded file is the only place this content lives. Paste one `PositioningDoc` JSON object or an array back into the form, submit — validates against `positioningDocSchema` and `replaceOne(..., { upsert: true })`s each by `_id`. No preview step; submitting writes immediately.

## 9. Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `MONGODB_URI` | The whole app (every DB read/write) | MongoDB Atlas connection string, `cv` database |
| `IRON_SESSION_SECRET` | Admin auth (`lib/session.ts`) | 32+ random chars, e.g. `openssl rand -hex 32`. Never commit a real value. |
| `ADMIN_PASSWORD` | Admin login (`/api/auth/login`) | Single password, not hashed — this is a personal single-user tool, not a multi-user system. |
| `GOOGLE_SERVICE_ACCOUNT_KEY_B64` | Nothing in the deployed app | Only read by `scripts/test-google-service-account.ts` (dev tooling, not imported by any `app/` route) |
| `GOOGLE_DRIVE_TEST_FOLDER_ID`, `GOOGLE_SHEETS_TEST_SPREADSHEET_ID` | Nothing in the deployed app | Same script as above |

`.env.example` documents the placeholder format for all of these; `.env.local` is gitignored. Confirm `.gitignore` still excludes `.env*` (except `.env.example`) before ever committing.

## 10. Known gaps / possible future work

- **Pagination**: page breaks fall only between whole entries (`wrap={false}`), never mid-bullet. A positioning with many included bullets across all roles may still export to 2 pages.
- **No role exclusion**: `assemble()` always includes every role from `profile.experience`; a positioning can only filter *which bullets* appear per role (§7.2), not drop a role entirely.
- **No versioning/audit trail**: editing `profile`/`positioning` overwrites in place; no history of what a given exported PDF actually contained when sent to an employer.
- **No photo upload UI**: the photo is a fixed asset (`public/photo.jpg`); swapping it means replacing that file directly.
- **Single shared admin password**: fine for a single-user personal tool; would need real multi-user auth if this is ever shared.

## 11. Deployment

Vercel project **`avis/cv`** (linked via `vercel link`). Custom domain **chafiqjalal.com** is attached to this project, but as of the last check its nameservers didn't match what Vercel expects (Cloudflare nameservers detected, verification showing ✘) — confirm DNS is actually resolving before treating the custom domain as live; the `*.vercel.app` production URL is confirmed `Ready` independent of that.

- Import the repo or run `vercel` from this directory — Vercel detects `pnpm-lock.yaml` and uses pnpm automatically.
- Set `MONGODB_URI`, `IRON_SESSION_SECRET`, `ADMIN_PASSWORD` in the Vercel project's Environment Variables (Production + Preview) — see §9. Add via the dashboard UI; the CLI's `--value` flag has been unreliable for this project.
- `/api/export-pdf` must run on the Node.js runtime (already set via `export const runtime = "nodejs"`), not Edge — `@react-pdf/renderer` isn't Edge-compatible.

## 12. Scripts

- `pnpm run dev` — dev server
- `pnpm run build` — production build
- `pnpm run start` — run the production build locally
- `pnpm run lint` — ESLint
- `pnpm run test` — runs `lib/assemble.test.ts` (plain `node:assert`, no framework)
- `pnpm run db:seed` — runs `scripts/seed.ts`, upserting `profile` and all `positionings` into MongoDB Atlas
- `pnpm run test:cv-pipeline` — fetches live Atlas data, runs `assemble()` + schema validation per positioning, reports bullet counts
- `pnpm run test:google` — Drive/Sheets connectivity check for the (currently app-unused) Google service account
