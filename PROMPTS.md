# Reusable Agent Prompts

Prompt patterns that have actually produced good results on this codebase. Copy one whole, replace the `{{...}}` placeholders, paste it as the task.

Each pattern follows the same three principles, which is where most of the value comes from:

1. **Anything appearing in two or more places becomes ONE named thing** — the duplication is the maintenance hazard, not the folder names.
2. **Run the real thing and look at it.** A passing build is not proof it works. A component can compile perfectly and render a blank page.
3. **Verify mechanically, not from memory.** Grep for every claim. An audit done from recall just re-asserts what the code already appears to say.

**Patterns in this file**

- [Structural Refactor for Readability](#pattern-structural-refactor-for-readability) — reorganize, dedupe, document, and delete dead code across a whole codebase.
- [Senior Frontend / Design Audit](#pattern-senior-frontend--design-audit) — find where the interface is inconsistent, inaccessible, or broken in unexamined states.

---

## Pattern: Structural Refactor for Readability

Act as a Principal Full-Stack Engineer and Tech Lead. Perform an unattended
structural refactor of this {{Next.js App Router / TypeScript / MongoDB}}
codebase so it is exceptionally readable, self-documenting, and maintainable by
a beginner developer.

Preserve all existing behaviour: business logic, external API calls, data
flows, and database operations must work exactly as before. This is a
restructuring pass, not a rewrite.

---

### PHASE 0: RECONNAISSANCE

1. Map the whole repository tree and read `package.json`.
2. Before changing anything, identify: orphaned files nothing imports,
   duplicated logic, oversized files doing several unrelated jobs, vague names,
   and misplaced modules.
3. Report what you found and what you plan to do. Do not act on assumptions —
   verify each claim with a grep or a read.

### PHASE 1: STRUCTURE

Reorganize to conventional {{framework}} layout. Use `git mv` so history follows.

- `app/` — routes and pages ONLY. Move inline logic out into `lib/`.
- `components/ui/` — generic reusable primitives.
- `components/{{feature}}/` — feature-specific components.
- `lib/db/` — connection plus ALL database queries. No query written inline
  anywhere else.
- `lib/{{domain}}/` — core services (API clients, prompt builders, schemas).
- `lib/utils/` — generic helpers. `lib/hooks/` — client-side hooks.
- `types/` — shared contracts, split by area, with an index barrel.

Any logic appearing in two or more places becomes ONE named helper in the layer
that owns it. Call these out explicitly in your summary — they are the
highest-value part of this work.

### PHASE 2: SPLIT WHAT IS TOO BIG

Any file past ~250 lines that does several unrelated jobs gets split into one
file per job, leaving a small entry point that only decides which piece to use.
When splitting, make implicit coupling explicit — anything the extracted piece
reached into its parent for becomes a declared parameter or prop.

### PHASE 3: JSDOC FOR BEGINNERS

Add JSDoc to every exported function, type, route handler, and component:
what it does in plain language, `@param`, `@returns`.

Explain the WHY, not just the what, wherever the code is non-obvious: why a
value must be converted before crossing a boundary, why a fallback exists, why
a limit has that number. Add a 1–2 sentence comment above complex blocks and
number the steps in multi-stage flows.

Do NOT comment self-explanatory code. Do not restate the function name in prose.

### PHASE 4: NAMING AND DEAD CODE

1. camelCase utility files, PascalCase components, kebab-case route dirs —
   unless the surrounding code already follows a different convention
   consistently, in which case match what is there and say so.
2. Rename vague identifiers (`r`, `p`, `obj`, `tmp`, `data2`) to what they hold.
   Rename anything describing its mechanism rather than its purpose.
3. Named exports for utilities, not default exports.
4. Delete unreferenced files, unused exports, commented-out blocks, and stale
   debug logs. Un-export symbols used only inside their own module.
5. Anything you delete that might be called from outside the repo — a script, a
   bookmark, curl — flag it explicitly in your summary instead of deleting
   silently.

### PHASE 5: DOCUMENTATION AUDIT

Audit every `.md` in the repo against the code, claim by claim. Do not rewrite
from memory. Fix: undocumented required env vars, stale file paths and symbol
names, described behaviour that no longer exists, wrong API response shapes,
and wrong package manager or commands.

Then verify mechanically: extract every file path and code identifier from the
docs and confirm each one still exists in the source. Confirm every
`process.env` read is documented. Report anything you fixed.

### PHASE 6: VERIFICATION

1. Type-check. Fix all errors autonomously.
2. Build. It must pass with no errors.
3. **Run the application and exercise the changed paths.** A build passing is
   not proof it works — start the dev server, request the real pages and
   endpoints, confirm they return 200 and render the expected content, and
   check the logs for errors. If it touches a database, query through the new
   code path against real data and show the output.
4. **Never trigger a destructive action against real data to test it.** Point
   writes at a scratch database or a disposable record. If you cannot isolate
   it, verify the read path only and say plainly that the write path is
   unverified.
5. Report results honestly. If something fails or you skipped it, say so
   plainly with the output.

### PHASE 7: COMMIT

Stage everything and commit with a message stating what changed and WHY.
Do not push unless asked.

---

RULES:

- Behaviour-preserving. If a change alters behaviour, stop and say so.
- Do not templatize or genericize files containing real domain content —
  {{name any file with irreplaceable domain knowledge}}.
- Prefer explicit over clever: a beginner reading one file should not need to
  chase an abstraction to understand it. Do not add a wrapper to remove
  duplication when the duplication is more readable than the indirection.
- Work autonomously through all phases. Do not stop to ask about routine
  judgement calls.

---

### Why these phases and not a checklist

**Phase 1's dedupe rule** does most of the work. Folder names are cosmetic; the
duplicated id-parsing and the colour map copy-pasted into three components are
the actual maintenance hazard.

**Phase 6.3.** Most refactor prompts stop at "make it build". A JSX split
compiles perfectly and can still render a blank page. Requiring the app to be
run and inspected is what turns "should work" into "does work".

**Phase 5's mechanical check.** Docs audits done from memory just re-assert
what the doc already says. Grepping every documented path and symbol is what
surfaces the dead route reference and the undocumented env var.

**Phase 6.4 exists because it was learned the hard way** — a verification pass
that clicks a real Save button writes real test data to real production.

### Honest caveat

The "beginner-friendly" and "explain the why" instructions are the softest part.
You will get better results by pointing at a file whose commenting style you
already like than by trusting the adjective.

---

## Pattern: Senior Frontend / Design Audit

Act as a Principal Frontend Engineer with a strong visual-design background,
auditing this {{Next.js App Router + TypeScript + Tailwind}} application.

Your job is to find where the interface is inconsistent, inaccessible,
visually careless, or broken in states nobody looked at — and fix it.

Preserve all existing behaviour and all domain content. Do not restyle for
novelty, do not introduce a new design language, and do not "modernize"
anything that is already coherent. You are raising the floor, not redecorating.

---

### PHASE 0: INVENTORY — no changes yet

1. List every route/page, and for each one every **state** it can be in:
   loading, empty, error, partial data, unauthenticated, disabled, submitting,
   too-much-content. Build the real list from the code, not from assumption.
2. List every interactive component and where it is used.
3. Report the inventory and what you intend to change. Verify each claim with
   a grep or a read before you assert it.

State coverage is the single highest-yield part of this audit. Most interfaces
are designed for the happy path and fall apart on empty and error.

### PHASE 1: ONE SOURCE OF TRUTH FOR VISUAL VALUES

1. Find every hardcoded colour, font size, spacing value, radius, shadow, and
   breakpoint. Compare them against {{lib/tokens.ts / the theme config}}.
2. Any value that exists in more than one place becomes ONE named token, used
   everywhere. Call these out explicitly in your summary.
3. Where a value genuinely **cannot** be imported (a CSS file that can't read
   TS, a Tailwind class string that must be statically analysable), leave the
   duplicate but document the pairing rule at both sites, so the next person
   knows the two must move together.
4. Near-duplicate values are the real finding: two greys one hex apart, three
   almost-identical paddings. Collapse them and say which you kept.

### PHASE 2: COMPONENT DUPLICATION

Any block of JSX or class-string combination repeated in two or more places
becomes one named component or one shared constant, in the layer that owns it.

Do NOT abstract when the duplication is more readable than the indirection.
Two similar buttons with different semantics are two buttons. Say so, and
leave them.

Anything past ~250 lines doing several unrelated jobs gets split: one file per
job, with a small entry point that only decides which piece to render. When you
split, make implicit coupling explicit — anything the extracted piece reached
into its parent for becomes a declared prop.

### PHASE 3: THE STATES NOBODY DESIGNED

For every state from Phase 0, confirm the interface actually says something
useful. Fix the ones that don't:

- **Loading**: does layout shift when content arrives? Does it appear
  instantly on interaction, or only after the request resolves?
- **Empty**: does it explain what would fill this, or just render nothing?
- **Error**: does it say what failed and what to do next, or just a status code?
- **Disabled**: is it visibly disabled AND explained? A disabled button with no
  reason is a dead end.
- **Overflow**: long strings, long lists, small viewports. Does anything clip,
  overlap, or scroll the whole page sideways?

### PHASE 4: ACCESSIBILITY — mechanically, not by eye

1. Every interactive element reachable and operable by keyboard alone. Tab
   through every page and report the actual focus order.
2. Visible focus indicators everywhere. Never remove an outline without
   replacing it.
3. Every control has an accessible name. Every icon-only button has a label.
   Every input is associated with a real label element.
4. Compute contrast ratios for text and interactive elements; report the
   numbers, don't eyeball them. Flag anything under 4.5:1 for body text.
5. Semantic structure: one h1 per page, headings not skipping levels,
   lists as lists, buttons as buttons, links as links.
6. State conveyed by more than colour alone.

### PHASE 5: RESPONSIVE AND OUTPUT PARITY

1. Check every page at {{375 / 768 / 1280 / 1920}}px wide.
2. Nothing may scroll the body horizontally. Wide content (tables, code,
   diagrams) scrolls inside its own container.
3. {{If the app has a second render target — print, PDF, email — verify the
   two stay identical where they are supposed to, and document every place
   they deliberately diverge.}}

### PHASE 6: VERIFICATION — the part that matters

1. Type-check and lint. Fix everything autonomously.
2. Build. It must pass clean.
3. **Run the application and look at it.** Start the dev server, load every
   page you touched, drive the real controls, and confirm each renders what you
   expect. Capture screenshots at each breakpoint. Read the browser console and
   report anything in it.
4. Exercise the states from Phase 0 deliberately — force an error, force an
   empty list, force a long string. "It should handle that" is not a result.
5. **Never trigger a destructive action against real data to test it.** Point
   writes at a scratch database or a disposable record. If you cannot isolate
   it, verify the read path only and say plainly that the write path is
   unverified.
6. Report results honestly. If something failed, or you skipped it, say so with
   the output.

### PHASE 7: REPORT

Summarize as: what was duplicated and is now shared; which states were missing
and now exist; which accessibility failures were real and are fixed; what you
found but deliberately did NOT change, and why.

Stage and commit with a message stating what changed and why. Do not push
unless asked.

---

RULES:

- Behaviour-preserving and content-preserving. If a change alters either, stop
  and say so before continuing.
- Never alter real domain content to make a layout work. Fix the layout.
- Prefer explicit over clever. Someone reading one component should not have to
  chase an abstraction to understand what it renders.
- A finding you cannot reproduce is not a finding. Drop it or prove it.
- Work autonomously through all phases. Do not stop to ask about routine
  judgement calls.

---

### Why these phases and not a checklist

**Phase 0's state inventory** does most of the work. "Audit the frontend"
produces opinions about colours; "list every state every page can be in, then
check each one" produces the empty-list screen that was never designed and the
error that renders as `500`.

**Phase 6.3.** Most audit prompts stop at "make it build". Requiring the app to
be run, driven, and screenshotted is what separates "should look right" from
"does look right".

**Phase 4's insistence on numbers.** "Check contrast" gets you a reassuring
paragraph. "Compute the ratios and report them" gets you `3.9:1` on the muted
help text.

**Phase 6.5 exists because it was learned the hard way** — a verification pass
that clicks a real Save button writes real test data to real production. Isolate
writes, always.

### Honest caveat

The soft spots are Phase 1's "near-duplicate" judgement and Phase 2's
~250-line threshold. Both are arbitrary and will cause some churn. You will get
better results by pointing at a file whose structure you already like and
saying "match this" than by trusting the number.
