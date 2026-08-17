# Explore — bootstrap or refresh project understanding

Run when: the skill has never been used in this repo (no `.pom-generator/conventions.md` exists),
OR the user asks to "explore", "learn my framework", "refresh conventions", OR the framework has
changed significantly since the last run.

Goal: understand **everything** about how this project's Playwright framework is built AND how it
is actually used in real tests — not just the shape of the Page Object files, but the usage
patterns, conventions, and dependencies around them.

Nothing is changed or "fixed" here. That is a separate, explicitly-requested stage (see 0.5).

Output, in the **user's repo** at `.pom-generator/` — not in this skill's folder, which is portable
across repos:

- `conventions.md`
- `component-registry.md`
- `structure-notes.md`

Work through the sub-stages in order. **After each one, show what you found and wait for
confirmation or corrections.** Never collapse several sub-stages into one uninterrupted pass — the
checkpoint is what lets the user catch a wrong inference before it propagates.

---

## 0.0 — Language, test framework, tooling

Before scanning for conventions, determine:

- **Language** — `package.json` + `.ts`/`.js` (TypeScript/JavaScript), `pyproject.toml`/
  `requirements.txt` + `.py` (Python), `.csproj` (C#), `pom.xml`/`build.gradle` (Java/Kotlin)
- **Playwright binding and API style** — for Python especially, sync vs. async (`sync_playwright`
  vs `async_playwright`, `def` vs `async def` tests); this materially changes what generated code
  looks like. For JS/TS confirm async/await usage
- **Test runner** — pytest, Jest/Vitest, JUnit/TestNG, NUnit
- **Type-check and lint tooling actually configured** — read the config files. Do not assume
  ESLint/tsc for a TS repo, or mypy for Python, without checking

Record under a "Language & tooling" section at the top of `conventions.md`. **Every later stage,
including generation, must respect what is recorded here** rather than assuming a language or
toolchain.

If the repo mixes languages (TS UI tests + Python API tests), ask which one this skill instance
targets, or scope to one directory tree at a time. Conventions and registry are per-language; if
both are tracked, keep them in clearly separate sections or files and say so.

→ **STOP.** Show findings. Wait.

## 0.1 — Structure and base classes

Scan the Page Object code (`src/pages`, `src/elements`, `src/components`, or the
language-appropriate equivalent — ask if unclear). Identify:

- folder layout and what lives where
- base classes (`BasePage`, `BaseElement` or equivalents) and exactly what they provide —
  constructor signature, shared methods, generics/type parameters
- how files are exported and registered (barrel files, `__init__.py`, explicit imports)
- any dependency-injection or fixture pattern used to construct Page Objects in tests (custom
  Playwright fixtures, `test.extend()`, pytest fixtures)

→ Draft the "Structure & base classes" section of `conventions.md`.
→ **STOP.** Show it. Wait.

## 0.2 — Naming and locator strategy

Scan actual locator usage across existing files:

- the real priority order **actually used** (data-testid vs role vs text vs css) — not what is
  supposed to be used, what is there
- naming actually used for classes, locator getters, action methods (`click...`), state readers
  (`get...`/`is...`), respecting the language's idiomatic casing
- any consistent suffix/prefix convention (`...Locator` vs a bare noun)

→ Append the "Naming & locators" section.
→ **STOP.** Show it. Wait.

## 0.3 — Custom element patterns

Find every recurring custom widget wrapper — dropdowns, tables, modals, badges, date pickers. For
each, capture the DOM signature, wrapper class and file, key methods, and what it should not be
confused with.

**Every entry gets a `Fingerprint:`** (`registry-format.md`) — a real selector that matches this
component's root wherever it appears. Derive it from the selectors the wrapper class itself uses:
the class knows what it locates by, and that is by definition the signature of the thing it wraps.
The analyze run's recognition pass matches whole pages against these fingerprints in bulk, and
every control it recognizes is a control it never has to probe — this field is what makes analysis
fast, so it is worth a minute per entry to get right.

→ Write `component-registry.md` using the entry format in `registry-format.md`.
→ **STOP.** Show it. Wait.

## 0.4 — Usage patterns: how tests actually consume the framework

This is about the framework's **API ergonomics as experienced from the test files**, not the Page
Object internals. Read a representative sample of real tests, not just POM classes.

**Multi-element and list handling.** When a test needs one of several matching elements, how is it
actually done here? Raw `.nth(i)`/`.first()`/`.last()` in test files? A custom indexing method on
the Page Object (`getRow(index)`, `getItemByName(text)`)? Both, inconsistently — flag that as a
conflict rather than silently picking one. Document the dominant pattern and the actual method
names in use.

**Return types of those methods.** For each indexing method: does it return a raw `Locator`, or an
instance of a wrapper class? Async or sync? Is there a consistent rule ("anything returning a
single item returns a wrapped class, never a raw Locator"), or is it mixed?

**Iteration over full collections.** `.all()`, a custom `getAllRows()` returning wrapper instances,
something else?

**Navigation and element-return conventions.** Do action methods that navigate return nothing,
return the next Page Object for fluent chaining, or require the caller to construct the next page?
Is there a consistent fluent style, or is each navigation handled ad hoc? Are elements always
obtained via a getter on the Page Object, or sometimes constructed inline in test files with a raw
locator call? Frequent inline construction signals gaps in Page Object coverage that tests are
working around — note it.

→ Draft the "Usage patterns" section, including **actual method signatures and return types as
concrete examples**, not paraphrased.
→ **STOP.** Show it. Wait.

**This section is load-bearing for generation.** P2 and the emit phase read it to decide what
generated indexing methods return and whether navigation chains. Getting it wrong makes every
generated file subtly wrong.

## 0.5 — Structural observations (advisory only)

Based on 0.0–0.4, note anything that stands out — inconsistencies, duplication, ergonomics
friction, divergence from common Playwright POM practice. For example: mixed raw-Locator and
wrapped return types; iteration handled differently in different files; base-class methods that get
hand-rolled repeatedly in tests; constructors that do not compose with the fixture pattern.

Write `.pom-generator/structure-notes.md` — a plain list, each with:

- what was observed, with a file reference
- why it may be worth reconsidering, grounded in a concrete downstream cost ("tests can't be typed
  strictly because `getRow()` returns `Locator` in 3 files and `TableRow` in 2 others")
- a possible direction, stated as a suggestion, not a decision

**Purely informational.** Do not modify framework code from it, and do not fold these into
`conventions.md` as if they were established convention — they are proposals. Mention the file
exists when this sub-stage completes.

→ **STOP.** Show it. Wait for confirmation, edits, or "skip".

## 0.6 — Dependencies and environment

Capture in a "Dependencies" section:

- Playwright version and relevant config (`playwright.config.ts`/`pytest.ini`/`conftest.py` —
  projects, timeouts, base URL handling). **Record the viewport**; analysis runs at it
- fixture setup and what it injects
- non-Playwright libraries the framework depends on (custom assertion library, data factory,
  API-mocking layer)
- type-system strictness relevant to how POM classes are typed (TS `strict`/`noImplicitAny`,
  mypy strictness) — this decides whether return types should be explicit

→ Append to `conventions.md`.
→ **STOP.** Show it. Wait.

---

## Re-running Explore

If a re-run finds existing files, **diff against them rather than overwriting**. Propose additions
and changes, and explicitly flag anything that contradicts an existing entry — never silently
resolve a conflict.

If inconsistent usage is found anywhere in 0.0–0.4 (the same pattern handled differently in
different files), flag it as a conflict for the user to resolve rather than picking one silently.
This applies to usage patterns (0.4) as much as to naming or component identification.
