# CV Generator — Jalal Chafiq

A positioning-based CV generator with pixel-faithful PDF export. Underlying facts (roles, bullets, education, skills) live once in a MongoDB `profile` document; a `positioning` document selects and frames that material per application (which bullets to surface, which skills to lead with, which language) without ever duplicating text. Anyone with the URL can view and export any CV; editing is behind a single-admin, session-based login.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in MONGODB_URI, ADMIN_PASSWORD, IRON_SESSION_SECRET
pnpm run db:seed             # pushes profile + positionings from scripts/seed.ts into Atlas
pnpm run dev
```

Open http://localhost:3000. Click "Admin" in the top nav and log in with `ADMIN_PASSWORD` to edit content.

## Project structure

```
app/          Next.js App Router — public Home (/), gated admin editor and job-offer generator (/admin/*), API routes
components/   CVPreview (web) / CVDocument (PDF) — pixel-matched via lib/tokens.ts — plus nav/auth UI
lib/          Shared types, MongoDB client, assemble() merge logic, zod schemas, iron-session config
scripts/      One-off/dev-tooling scripts: seed, pipeline verification, Google connectivity check
public/       Static assets (profile photo)
```

Full architecture, data model, auth model, route reference, and deployment notes: **[DOCS.md](./DOCS.md)**.

## Deployment

Hosted on Vercel (`avis/cv` project). Live at **[chafiqjalal.com](https://chafiqjalal.com)**. See [DOCS.md §11](./DOCS.md#11-deployment) for environment variables and the Node.js runtime requirement on the PDF export route.
