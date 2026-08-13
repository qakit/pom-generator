# Generate — emit

`/pom-generate <slug>` turns a validated analysis artifact into Page Object files.

It does **not** open a browser to decide anything. Every question about the page was answered in
`/pom-analyze` and is recorded in the artifact. The browser comes back only in `verify.md`, to
check the code that was written.

---

## 1. The gate

**First action, before reading anything else:**

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" .pom-generator/analysis/<slug>
```

| Exit | Meaning | Do |
|---|---|---|
| 0 | clean | proceed |
| 1 | errors | **stop. Write nothing.** Show the report. The analysis is incomplete — the fix is to finish it with `/pom-analyze <url> --phase=<phase>`, not to generate anyway |
| 2 | warnings only | proceed, and surface the warnings in the final summary |

Paste the validator's actual output. A `blocked-safety` element is a decision the user already
made, which is why warnings do not block; a `pending` element is work that was never done, which is
why errors do.

Never edit the artifact to get past the gate. The artifact describes the page; changing it to
satisfy a rule makes it describe nothing.

## 2. Read the inputs

- `.pom-generator/analysis/<slug>/analysis.md` — the entire spec for what to write
- `.pom-generator/conventions.md` — language, structure, naming, base classes, usage patterns
- `.pom-generator/component-registry.md` — what to import rather than re-create
- **one or two existing Page Objects** closest in shape to what you are writing (form-heavy,
  table-heavy, dialog). Read them. `conventions.md` describes the style; a real file *is* the
  style, and matching it is the entire point of this tool

Generate in the language and API style recorded in `conventions.md` Stage 0.0 — never default to
TypeScript assumptions if the project is Python, and respect sync vs. async as detected.

## 3. Write, deepest first

Order matters: a parent imports its children, so write leaves first and the page last.

1. `[REUSE]` entries — no file, just imports
2. nested components, innermost first
3. top-level components
4. the page
5. barrel/index exports, if the project uses them

For each manifest row, take everything from the artifact:

| Artifact field | Becomes |
|---|---|
| `Locator` | the getter's selector, verbatim |
| `Type` | the wrapper shape — see the catalog entry's `**Wrapper shape:**` |
| `Observed` | what the action method is named for, and what its doc comment says it does |
| `Registry: <Class>` | an import and a typed member, not a new class |
| `Registry: NEW` | a new class **plus** a `// REVIEW: new pattern, not in registry` comment |
| `Reveals: C-nn` | the opener method returns that component |
| `Affects` | a note in the method's doc comment about what else changes |

Method names come from observed behaviour, not labels (`rules/element.md` E9). A button labelled
"Go" that applied filters is `applyFilters()`.

Mark `blocked-*` elements with a comment saying what is unverified and why — a getter whose
behaviour was never observed should say so in the file, not look identical to one that was.

## 4. What not to invent

The artifact is the whole spec. If something is not in it, it was not observed, and writing it is
a guess dressed as a wrapper.

- no getters for elements that are not in `## Elements`
- no methods for behaviour that is not in an `Observed:`
- no selectors that are not in a `Locator:`
- no assertions, no test cases, no fixtures unless `conventions.md` shows the POM layer owning them

If you find yourself wanting an element that is not there, that is a gap in the analysis. Say so;
do not fill it.

## 5. Type-check and lint

Run **the project's own tooling**, as recorded in `conventions.md` Stage 0.0/0.6. Never a
hardcoded tool: do not assume `tsc` or ESLint for a TypeScript repo, or mypy for Python, without
the config file saying so.

Fix every error before presenting. A generated file that does not compile is not a deliverable.

## 6. Verify

Follow `verify.md` — exercise the generated locators against the live page. Do not skip this
because the code compiles; compiling proves nothing about whether a selector resolves.

## 7. Update the manifest and present

Set each manifest row to `written`, then `verified` once verification passes, and
`Meta.Phase: generated`.

Present:

- the diff
- which elements reused existing wrapper classes, and which are `REVIEW`-flagged as new
- what verification caught and fixed
- any validator warnings from step 1
- anything `blocked-*` that is therefore unverified in the generated code

---

## Re-generation

When `## Delta` is present, regenerate only the files whose components contain added, removed or
changed elements. Unchanged files are left alone.

**Before overwriting any file, check whether it has been modified since it was generated**
(`git status` / `git log` on that path). If it has:

1. **Stop. Do not overwrite.**
2. Show the user what changed in their version and what the new generation would produce.
3. Ask how to proceed.

A hand-edit is a correction the user made deliberately — it is exactly the signal
`/pom-learn` exists to absorb, and destroying it silently is the worst thing this tool could do.
Suggest running `/pom-learn` on it so the correction becomes a convention rather than something to
re-apply by hand every time.
