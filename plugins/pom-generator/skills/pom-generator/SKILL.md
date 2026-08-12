---
name: pom-generator
description: Use this skill for anything related to generating, updating, or maintaining Playwright + TypeScript Page Object wrappers from a real running application. Trigger this whenever the user asks to "wrap a page", "generate a page object", "create a POM", "explore the framework", "learn my conventions", or mentions component-registry, page objects, or test framework wrappers for Playwright/TS. Also trigger after the user manually edits a generated Page Object and wants the skill to learn from the correction. Push to use this proactively any time a Playwright+TS test framework and page-wrapping task come up together, even if the user doesn't name the skill explicitly.
---

# Playwright POM Generator

Generates Page Object Model wrappers (pages/elements/components) for a Playwright + TS
test framework, matching the existing conventions of the user's own codebase — not
generic boilerplate.

This skill has three stages. Figure out which one the user needs and jump in.

## Stage 0 — Explore (bootstrap or refresh full project understanding)

Run when: the skill has never been used in this repo (no `.pom-generator/conventions.md`
exists yet), OR the user asks to "explore", "learn my framework", "refresh conventions",
or the framework has changed significantly since last explore.

Goal of this stage: understand **everything** about how this project's Playwright + TS
framework is built AND how it's actually used in real tests — not just the shape of the
Page Object files, but the usage patterns, conventions, and dependencies around them.
Nothing gets changed or "fixed" in this stage — that's a separate, later stage
(see Stage 3 — Improve/Suggest, not run automatically, only on explicit request).

Output location: **`.pom-generator/` in the user's repo** (NOT inside this skill folder —
this skill is portable across repos, exploration output is repo-specific):
- `conventions.md`
- `component-registry.md`
- `structure-notes.md` (new — see Stage 0.5 below)

Work through the sub-stages below in order. After EACH sub-stage, show the user what
you found/drafted and wait for confirmation or corrections before moving to the next.
Never collapse multiple sub-stages into one uninterrupted pass — the checkpoint is what
lets the user catch a wrong inference before it propagates into later stages.

### Stage 0.1 — Structure & base classes

Scan `src/pages`, `src/elements`, `src/components` (or wherever the user's POM code
lives — ask if unclear). Identify:
- Folder layout and what lives where
- Base classes (`BasePage`, `BaseElement` or equivalents) and exactly what they provide
  (constructor signature, shared methods, generics used)
- How files are exported/registered (barrel files, `index.ts`, explicit imports)
- Any dependency injection or fixture pattern used to construct Page Objects in tests
  (e.g. custom Playwright fixtures, a `test.extend()` setup)

→ Draft the "Structure & base classes" section of `conventions.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.2 — Naming & locator strategy

Scan actual locator usage across existing files:
- Real priority order actually used (data-testid vs role vs text vs css) — not what's
  "supposed" to be used, what's actually there
- Naming convention actually used for classes, locator getters, action methods
  (`click...`), state-read methods (`get...`/`is...`)
- Any consistent suffixing/prefixing convention (e.g. `...Locator` vs bare noun)

→ Append the "Naming & locators" section to `conventions.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.3 — Custom element patterns

Find every recurring custom widget wrapper (dropdowns, tables, modals, badges, date
pickers, etc). For each, capture the DOM signature, wrapper class + file, key methods,
and what it should not be confused with.

→ Write `component-registry.md` using the entry format in `references/registry-format.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.4 — Usage patterns: how tests actually consume the framework

This is about the framework's **API ergonomics as experienced from the test files**,
not the Page Object internals. Read a representative sample of actual `.spec.ts` /
`.test.ts` files (not just the POM classes) and answer:

- **Multi-element / list handling.** When a test needs one of several matching
  elements, how is it actually done in this codebase?
  - Raw Playwright `.nth(i)` / `.first()` / `.last()` calls directly in test files?
  - A custom indexing method on the Page Object (e.g. `getRow(index)`,
    `getItemByName(text)`, `getNthCard(i)`)?
  - Both, inconsistently? (flag this as a Stage 0.6 conflict, don't silently pick one)
  - Document the dominant pattern and any custom indexing method names actually in use.

- **Return types of these methods.** For each iteration/indexing method found, note
  exactly what it returns:
  - A raw `Locator`?
  - An instance of a wrapper class (e.g. `TableRow`, `ProfileCard`)?
  - A `Promise<T>` requiring `await`, or a synchronous chainable locator?
  - Is there a consistent rule (e.g. "any method returning a single item returns a
    wrapped class instance, never a raw Locator") — or is it mixed?

- **Iteration over full collections.** How does the codebase loop over "all matching
  elements" when a test needs that — `locator.all()`, a custom `getAllRows()` returning
  `Promise<TableRow[]>`, or something else? Note the actual pattern.

- **Navigation and element-return conventions.** How do Page Object methods that cause
  navigation behave?
  - Do action methods that navigate (e.g. `clickProfile()`) return `void`, return the
    new Page Object instance (`clickProfile(): ProfilePage`), or require the caller to
    manually construct the next page?
  - Is there a consistent "fluent" chaining style, or is each navigation handled ad hoc
    in the test?
  - How are elements initially obtained — always via a getter on the Page Object, or
    sometimes constructed inline in test files with raw `page.locator(...)`? If the
    latter happens often, note it — it signals gaps in the Page Object coverage that
    tests are working around.

→ Draft the "Usage patterns" section of `conventions.md`, including the actual method
  signatures/return types you found as concrete examples (not paraphrased).
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.5 — Structural observations (advisory only, not applied)

Based on everything gathered in 0.1–0.4, note anything about the current structure that
stands out — inconsistencies, duplication, ergonomics friction, or places where the
framework diverges from common Playwright POM best practices (e.g.: mixing raw Locators
and wrapped return types inconsistently; iteration handled differently in different
files; missing base-class methods that get hand-rolled repeatedly in tests; Page Object
constructors that don't compose well with Playwright fixtures).

Write these as `.pom-generator/structure-notes.md` — a plain list of observations, each
with:
- what was observed (with a file reference)
- why it may be worth reconsidering (grounded in a concrete downstream cost, e.g. "tests
  can't be typed strictly because `getRow()` returns `Locator` in 3 files and `TableRow`
  in 2 others")
- a possible direction, stated as a suggestion, not a decision

**This file is purely informational at this stage.** Do not modify any actual framework
code based on it, and do not fold these observations into `conventions.md` as if they
were established convention — they are proposals for the user to evaluate. This becomes
the input for a separate, explicitly-requested `Stage 3 — Improve/Suggest` skill stage,
which is not run automatically as part of Explore. Mention this file's existence to the
user when this sub-stage completes.

→ STOP. Show it. Wait for confirmation, edits, or "skip/not now."

### Stage 0.6 — Dependencies & environment

Capture, in a short "Dependencies" section of `conventions.md`:
- Playwright version and any relevant config (`playwright.config.ts` — projects,
  timeouts, base URL handling)
- Fixture setup (custom `test.extend()` fixtures, if any, and what they inject)
- Any non-Playwright libraries the framework itself depends on (e.g. a custom assertion
  library, a data-factory library, an API-mocking layer)
- TypeScript strictness settings relevant to how POM classes are typed (`strict`,
  `noImplicitAny`, etc. — affects whether return types should be explicit)

→ Append to `conventions.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Re-running Explore

If a re-run finds existing `conventions.md` / `component-registry.md` /
`structure-notes.md`, diff against what's there rather than overwriting. Propose
additions/changes, and explicitly flag anything that contradicts an existing entry —
never silently resolve a conflict.

If inconsistent usage is found anywhere in Stages 0.1–0.4 (same type of element or
pattern handled differently in different files), flag it as a conflict for the user to
resolve rather than picking one silently — this applies as much to usage patterns
(Stage 0.4) as it does to naming or component identification.

## Stage 1 — Generate

Run when: the user gives a URL (or asks to wrap a page/flow) and
`.pom-generator/conventions.md` already exists.

Read `references/generate-single.md` for wrapping one page, or
`references/generate-flow.md` for a multi-page/multi-step navigation flow
(page A → click → modal or page B → ...).

Both always:
- read `.pom-generator/conventions.md` and `component-registry.md` first
- consult the registry before creating any new element wrapper class
- mark genuinely new patterns with `// REVIEW: new pattern, not in registry`
- respect the action allowlist in `references/action-safety.md` (no destructive clicks,
  no form submits, unless the user explicitly asked for that exact action)
- run `tsc --noEmit` (and the project's linter, if configured) before presenting the diff

## Stage 2 — Learn from correction

Run when: the user has manually edited a file this skill generated and wants the
correction absorbed, or explicitly asks to "learn from this diff".

Read `references/learn-from-diff.md` and follow it precisely — the core rule is:
distinguish a one-off fix from a systemic pattern, and only write systemic patterns
back into `conventions.md` / `component-registry.md`, always with the user's
confirmation before saving.

## Safety (applies in every stage)

Never perform, without explicit per-instance permission from the user: form submission,
clicks on buttons/links whose accessible name suggests deletion, confirmation, or any
data-mutating action (Delete, Remove, Confirm, Submit, Send, Pay, etc.), or any action
that would trigger a non-idempotent network request. Navigation, hovering, and reading
snapshots are always fine.

Never read or reference credential files (`.env`, `storageState.json`, etc.) directly —
this skill only needs the *path* to an already-authenticated browser session, provided
by the user's Playwright MCP configuration, not the credentials themselves.
