---
name: pom-generator
description: Use this skill for anything related to generating, updating, or maintaining Page Object wrappers (Playwright, any language) from a real running application. Trigger this whenever the user asks to "wrap a page", "generate a page object", "create a POM", "explore the framework", "learn my conventions", or mentions component-registry, page objects, or test framework wrappers. Also trigger after the user manually edits a generated Page Object and wants the skill to learn from the correction. Push to use this proactively any time a Playwright test framework and page-wrapping task come up together, even if the user doesn't name the skill explicitly.
---

# Playwright POM Generator

Generates Page Object Model wrappers (pages/elements/components) for a Playwright test
framework, matching the existing conventions of the user's own codebase — not generic
boilerplate. Language-neutral: works with TypeScript/JavaScript, Python, or other
Playwright bindings, by detecting what the project actually uses rather than assuming.

This skill has three stages. Figure out which one the user needs and jump in.

## Locating this skill's own files (read this before anything else)

Every `references/*.md` path mentioned anywhere in this skill (in this file or in any
command) is **relative to this skill's own installation folder — the same directory
this `SKILL.md` file itself is in — never relative to the current project/repo you're
working in.** For example, if this file's own path is
`.../skills/pom-generator/SKILL.md`, then `references/generate-single.md` means
`.../skills/pom-generator/references/generate-single.md`.

Do **not** use a generic project-wide search tool (glob/grep across the current
working directory) to find these files — that searches only the current workspace and
will report them as missing even though they exist elsewhere on disk. This matters
especially when the skill is installed at the **user level**
(`~/.claude/skills/pom-generator/...`) rather than inside the current project — that
location is outside the workspace your file-search tools are scoped to.

**How to resolve the real path:**
1. If you know the absolute path this `SKILL.md` was loaded from, build the reference
   path from that same base directory (swap `SKILL.md` for `references/<file>`).
2. If you don't know it, use a shell command (not a workspace-scoped search) to find
   it directly — e.g. `ls ~/.claude/skills/pom-generator/references/` on macOS/Linux,
   or check `%USERPROFILE%\.claude\skills\pom-generator\references\` on Windows. A
   project-level install at `.claude/skills/pom-generator/` in the current repo (if
   present) takes priority and is directly reachable by normal search — check there
   first if unsure which install is active.
3. Once you have the real path, `Read` it directly. Only report the file as
   unavailable after actually trying a shell-based lookup — a workspace-scoped glob
   returning nothing is not sufficient evidence the file doesn't exist.

**Because path resolution can go wrong, the most safety-critical rules are repeated
directly in this file below (see "Safety") so they apply even if a reference file
can't be located** — but the detailed procedures in the reference files should still
always be sought out and read, not skipped just because this file's summary exists.


## Stage 0 — Explore (bootstrap or refresh full project understanding)

Run when: the skill has never been used in this repo (no `.pom-generator/conventions.md`
exists yet), OR the user asks to "explore", "learn my framework", "refresh conventions",
or the framework has changed significantly since last explore.

Goal of this stage: understand **everything** about how this project's Playwright
framework is built AND how it's actually used in real tests — not just the shape of the
Page Object files, but the usage patterns, conventions, and dependencies around them.
Nothing gets changed or "fixed" in this stage — that's a separate, later, explicitly-
requested stage (see Stage 3 — Improve/Suggest, not run automatically as part of Explore).

Output location: **`.pom-generator/` in the user's repo** (NOT inside this skill folder —
this skill is portable across repos, exploration output is repo-specific):
- `conventions.md`
- `component-registry.md`
- `structure-notes.md` (advisory observations — see Stage 0.5)

Work through the sub-stages below in order. After EACH sub-stage, show the user what
you found/drafted and wait for confirmation or corrections before moving to the next.
Never collapse multiple sub-stages into one uninterrupted pass — the checkpoint is what
lets the user catch a wrong inference before it propagates into later stages.

### Stage 0.0 — Detect language, test framework, and tooling

Before scanning any code for conventions, determine:
- **Language**: look for `package.json`+`.ts`/`.js` files (TypeScript/JavaScript),
  `pyproject.toml`/`requirements.txt`+`.py` files (Python), `.csproj` (C#), `pom.xml`/
  `build.gradle` (Java/Kotlin), etc.
- **Playwright binding & API style**: for Python specifically, detect sync vs async
  usage (`sync_playwright` vs `async_playwright`, `def` vs `async def` test functions)
  — this materially changes what generated code should look like. For JS/TS, confirm
  async/await usage (near-universal, but confirm).
- **Test runner**: pytest, Jest/Vitest, JUnit/TestNG, NUnit, etc.
- **Type-check / lint tooling actually configured** in this repo (read config files —
  don't assume any particular tool just because it's a common default; e.g. don't
  assume ESLint/tsc for a TS repo without checking, don't assume mypy for Python
  without checking).

Record all of this at the top of `conventions.md` under a "Language & tooling" section.
Every later stage — including Stage 1 (Generate) — must respect what's recorded here
instead of assuming any particular language or toolchain.

If the repo mixes multiple languages (e.g. TS UI tests + Python API tests), ask the
user which one this skill instance should target, or scope explore to one directory
tree at a time. Conventions/registry files are per-language; if the user wants both
tracked, keep them in clearly separate sections or separate files and say so.

→ STOP. Show findings. Wait for confirmation or edits.

### Stage 0.1 — Structure & base classes

Scan the Page Object code (`src/pages`, `src/elements`, `src/components`, or the
language-appropriate equivalent location — ask if unclear). Identify:
- Folder layout and what lives where
- Base classes (`BasePage`, `BaseElement` or equivalents) and exactly what they provide
  (constructor signature, shared methods, generics/type parameters used)
- How files are exported/registered (barrel files, `__init__.py`, explicit imports)
- Any dependency injection or fixture pattern used to construct Page Objects in tests
  (e.g. custom Playwright fixtures, `test.extend()`, pytest fixtures)

→ Draft the "Structure & base classes" section of `conventions.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.2 — Naming & locator strategy

Scan actual locator usage across existing files:
- Real priority order actually used (data-testid vs role vs text vs css) — not what's
  "supposed" to be used, what's actually there
- Naming convention actually used for classes, locator getters, action methods
  (`click...`), state-read methods (`get...`/`is...`) — respecting the target
  language's idiomatic casing (camelCase for TS/JS, snake_case for Python, etc.)
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
not the Page Object internals. Read a representative sample of actual test files (not
just the POM classes) and answer:

- **Multi-element / list handling.** When a test needs one of several matching
  elements, how is it actually done in this codebase?
  - Raw Playwright `.nth(i)` / `.first()` / `.last()` calls directly in test files?
  - A custom indexing method on the Page Object (e.g. `getRow(index)`,
    `getItemByName(text)`, `getNthCard(i)`)?
  - Both, inconsistently? (flag this as a conflict, don't silently pick one)
  - Document the dominant pattern and any custom indexing method names actually in use.

- **Return types of these methods.** For each iteration/indexing method found, note
  exactly what it returns:
  - A raw `Locator`?
  - An instance of a wrapper class (e.g. `TableRow`, `ProfileCard`)?
  - Async (`Promise<T>`/`awaitable`) or sync?
  - Is there a consistent rule (e.g. "any method returning a single item returns a
    wrapped class instance, never a raw Locator") — or is it mixed?

- **Iteration over full collections.** How does the codebase loop over "all matching
  elements" when a test needs that — `.all()`, a custom `getAllRows()` returning a
  list/array of wrapper instances, or something else? Note the actual pattern.

- **Navigation and element-return conventions.** How do Page Object methods that cause
  navigation behave?
  - Do action methods that navigate (e.g. `clickProfile()`) return nothing, return the
    new Page Object instance for fluent chaining, or require the caller to manually
    construct the next page?
  - Is there a consistent "fluent" chaining style, or is each navigation handled ad hoc
    in the test?
  - How are elements initially obtained — always via a getter on the Page Object, or
    sometimes constructed inline in test files with a raw locator call? If the latter
    happens often, note it — it signals gaps in Page Object coverage that tests are
    working around.

→ Draft the "Usage patterns" section of `conventions.md`, including the actual method
  signatures/return types you found as concrete examples (not paraphrased).
→ STOP. Show it. Wait for confirmation or edits.

### Stage 0.5 — Structural observations (advisory only, not applied)

Based on everything gathered in 0.0–0.4, note anything about the current structure that
stands out — inconsistencies, duplication, ergonomics friction, or places where the
framework diverges from common Playwright POM best practices (e.g.: mixing raw Locators
and wrapped return types inconsistently; iteration handled differently in different
files; missing base-class methods that get hand-rolled repeatedly in tests; Page Object
constructors that don't compose well with the project's fixture pattern).

Write these as `.pom-generator/structure-notes.md` — a plain list of observations, each
with:
- what was observed (with a file reference)
- why it may be worth reconsidering (grounded in a concrete downstream cost, e.g. "tests
  can't be typed strictly because `getRow()` returns `Locator` in 3 files and `TableRow`
  in 2 others")
- a possible direction, stated as a suggestion, not a decision

**This file is purely informational at this stage.** Do not modify any actual framework
code based on it, and do not fold these observations into `conventions.md` as if they
were established convention — they are proposals for the user to evaluate. This is the
input for a separate, explicitly-requested future "Improve/Suggest" stage, which is not
run automatically as part of Explore. Mention this file's existence to the user when
this sub-stage completes.

→ STOP. Show it. Wait for confirmation, edits, or "skip/not now."

### Stage 0.6 — Dependencies & environment

Capture, in a short "Dependencies" section of `conventions.md`:
- Playwright version and any relevant config (`playwright.config.ts`/`pytest.ini`/
  `conftest.py` — projects, timeouts, base URL handling)
- Fixture setup (custom fixtures, if any, and what they inject)
- Any non-Playwright libraries the framework itself depends on (e.g. a custom assertion
  library, a data-factory library, an API-mocking layer)
- Type system strictness settings relevant to how POM classes are typed (TS `strict`/
  `noImplicitAny`, Python type-hint enforcement via mypy strictness, etc. — affects
  whether return types should be explicit)

→ Append to `conventions.md`.
→ STOP. Show it. Wait for confirmation or edits.

### Re-running Explore

If a re-run finds existing `conventions.md` / `component-registry.md` /
`structure-notes.md`, diff against what's there rather than overwriting. Propose
additions/changes, and explicitly flag anything that contradicts an existing entry —
never silently resolve a conflict.

If inconsistent usage is found anywhere in Stages 0.0–0.4 (same type of element or
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
- check login state first and wait for the user to log in manually if needed (see
  "Login handling" below) — never attempt to fill in credentials
- read `.pom-generator/conventions.md` and `component-registry.md` first
- generate code in the language/style detected during Stage 0.0 — never default to
  TypeScript assumptions if the project's actual language is something else
- apply `references/element-behavior-analysis.md` as a **mandatory, blocking**
  checklist: build a full inventory of interactive elements, actually probe every one
  of them (type/click/select and observe), and recurse into anything a click reveals
  (dialogs, cascading dropdowns) — never classify an element's behavior from its
  static appearance alone, and never write the wrapper file until every inventoried
  element has an observed outcome
- consult the registry before creating any new element wrapper class
- mark genuinely new patterns with a REVIEW comment in the target language's comment
  syntax (e.g. `// REVIEW: ...` for TS, `# REVIEW: ...` for Python)
- respect the action allowlist in `references/action-safety.md` (no destructive clicks,
  no form submits, unless the user explicitly asked for that exact action)
- self-verify generated wrappers against the live page (see
  `element-behavior-analysis.md`) before presenting
- run the type-check/lint tooling recorded in `conventions.md` (Stage 0.0/0.6) before
  presenting the diff — never hardcode a specific tool; use what the project uses

### Minimum inline checklist (fallback if `element-behavior-analysis.md` can't be found)

The reference file has full detail and should always be sought — but if path
resolution genuinely fails, this condensed version is the non-negotiable minimum,
not a replacement for trying to locate the full file:

1. List every interactive element in the snapshot before touching any of them —
   inputs, buttons, icon/svg-as-button, dropdowns, tabs, containers grouping them.
2. Actually interact with each one (type into inputs, click buttons, select dropdown
   values) and record the real observed result — never infer behavior from label/name
   alone, and never infer one button's behavior from a different button's tested
   behavior, even if they look similar or sit near each other. "Observed" (seen but
   not interacted with) is only valid for genuinely static/non-clickable elements —
   every button, checkbox, link, toggle, and tab must show a real action
   (Typed/Clicked/Selected), never "Observed", in the final inventory.
3. If a click opens a dialog: analyze the dialog's full contents the same way,
   recursively, before returning to the parent list. Do not skip this because it seems
   slower — this is the point of the exercise, not an optional extra.
4. If a dropdown selection changes other elements, note the dependency and analyze
   whatever it revealed the same way.
5. Treat any container with a shared grouping signal (attribute, CSS class stem,
   `data-*` prefix, or just "this is clearly one visual unit") as its own component
   class — never flatten it into loose getters on the parent.
6. Don't write the final file until every item from step 1 has a real recorded outcome.

### Login handling

The bundled Playwright MCP server runs **headed**, with its **default persistent
browser profile** (no `--isolated`, no `--storage-state` flag). This means:

- On navigating to a target page, check whether it looks logged in (absence of a login
  form/redirect, presence of expected authenticated UI). If unclear on first use, ask
  the user what "logged in" looks like for their app.
- **If not logged in:** tell the user plainly that a browser window is open and they
  should log in there, then let you know. **Stop and wait for their reply** — never
  attempt to fill in or submit a login form yourself, even if credentials are visible
  on the page (see `references/action-safety.md`). After they confirm, re-check before
  proceeding.
- Because the profile is persistent, this is normally a **one-time step per project** —
  the login is remembered automatically across future sessions.
- If the user's team instead needs a portable/shareable/CI-compatible session, that's
  an opt-in alternative — see `references/team-auth-mode.md`. It is not the default and
  should only be used if the user has explicitly set up that override.

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
snapshots are always fine. Never fill in or submit a login form on the user's behalf,
even during the Stage 1 login-wait flow — always wait for the human to log in manually.

**Absolute rule, no exceptions: never search for, read, or otherwise go looking for
credentials of any kind** — `.env` files, config, secrets, tokens, password managers,
browser storage — for any reason, including trying to determine or speed up login.
Login state is read only from the rendered page; login itself is always a human action.
If a prior stage's opt-in team/CI auth mode is configured (`references/team-auth-mode.md`),
this skill only ever needs the *path* to an already-authenticated session, never its
contents or the credentials that produced it.
