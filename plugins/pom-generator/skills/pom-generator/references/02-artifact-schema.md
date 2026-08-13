# Artifact schema: `analysis.md`

This is the contract between `/pom-analyze` (which writes it) and `/pom-generate` (which reads it
and writes no code unless it validates). The grammar is strict because a validator parses it —
see "Validator" at the end.

Location: `.pom-generator/analysis/<slug>/analysis.md`, with images in `./screens/`.
One file per page. Flows link several of these together; they do not merge them.

---

## Grammar rules that apply everywhere

1. **One field per line.** A field line is exactly `**Name:** value` — two asterisks, the field
   name, a colon, one space, then the value. Nothing else on the line.
2. **Field names are fixed and case-sensitive.** Unknown field names are an error, not a comment.
   Use `**Notes:**` for anything free-form.
3. **Block headers** are `### <ID> — <Human name>`. The separator may be an em dash, en dash, or
   hyphen surrounded by spaces.
4. **Section headers** are the five `##` headings below, each appearing exactly once, in order.
   All five exist from the moment the file is created; sections not yet filled contain the single
   line `_(pending)_`.
5. **Selectors, locators, and code go in backticks.** A field whose value is a selector must be
   backtick-quoted so the validator can distinguish it from prose.
6. **Multi-value fields** (`Contains`, `Reveals`, `Affects`, `Shots`) are comma-separated.
   Empty means the field is omitted entirely, not left blank.
7. **The file is rewritten after every element probe.** It is the durable state of the run, not a
   report written at the end. A crash or a context compaction costs one element, not the run.

---

## Section 1 — `## Meta`

| Field | Required | Value |
|---|---|---|
| `URL` | always | Full URL analyzed |
| `Slug` | always | Directory slug (see `01-glossary.md`) |
| `Analyzed` | always | ISO 8601 timestamp of the run that last touched this file |
| `Viewport` | always | `WIDTHxHEIGHT`, e.g. `1440x900` |
| `Baseline` | always | Path to the full-page baseline screenshot |
| `Phase` | always | `survey` \| `decomposed` \| `probed` \| `classified` \| `generated` |
| `Conventions` | optional | Marker for which `conventions.md` version this was analyzed against |
| `Tools-degraded` | optional | MCP tools found unavailable at preflight, comma-separated |
| `Notes` | optional | Free text |

`Phase` advances only when that phase's validator run passes. It is the resume point: a run that
finds `Phase: decomposed` skips P1 and P2 and goes straight to draining the probe queue.

## Section 2 — `## Regions`

One `### R-nn — Name` block per visually distinct area found during survey.

| Field | Required | Value |
|---|---|---|
| `Root` | always | Backticked selector for the region's container |
| `Shot` | always | Path to the region screenshot |
| `Contains` | always | Comma-separated `E-nn` IDs. Must be non-empty |
| `Component` | when applicable | `C-nn` if this region is a component revealed during probing |
| `Notes` | optional | Free text |

## Section 3 — `## Elements`

One `### E-nn — Name` block per element. Fields become required as the phase advances — this is
what lets the same validator gate every checkpoint.

| Field | Required from phase | Value |
|---|---|---|
| `Region` | survey | The `R-nn` this element belongs to |
| `Visual` | survey | What it looks like, taken from the screenshot — shape, colour, iconography, position. Written *before* the DOM is consulted |
| `Snapshot-ref` | survey | The accessibility snapshot ref (`e47`) |
| `DOM` | survey | Backticked tag/selector plus role and relevant aria/data attributes |
| `Kind` | survey | `actionable` \| `static` \| `container` |
| `Type` | survey | A type id from `catalog/index.md` |
| `Status` | survey | See `01-glossary.md`. Starts as `pending` |
| `Probe` | probed | Action verb + what was done. `Observed` is illegal here |
| `Observed` | probed | What actually changed. Concrete and specific |
| `Shots` | probed (actionable only) | `before.png, after.png` paths |
| `Reset` | probed (actionable only) | How baseline state was restored |
| `Reveals` | when applicable | `C-nn` / `E-nn` IDs this interaction brought into existence |
| `Affects` | when applicable | IDs of other elements this one changes |
| `Registry` | classified | `NEW` or the name of the existing wrapper class that matches |
| `Locator` | classified | Backticked, rooted at `this.element` for component-owned elements |
| `Locator-pw` | classified | What `browser_generate_locator` returned |
| `Locator-agree` | classified | `yes`, or `no — <reason>` |
| `Notes` | optional | Free text |

### A worked block

```md
### E-04 — Status filter
**Region:** R-02
**Visual:** pill-shaped control, grey border, chevron on the right, reads "All statuses"
**Snapshot-ref:** e47
**DOM:** `div[class*='_select_']` role=combobox aria-haspopup=listbox
**Kind:** actionable
**Type:** selection/single-select
**Probe:** Selected "Active"
**Shots:** ./screens/E-04-before.png, ./screens/E-04-after.png
**Observed:** listbox opened with 4 options (All, Active, Suspended, Archived); on select, GET /api/employees?status=active fired; table went 84 -> 31 rows; E-11 row count label updated
**Reveals:** C-03
**Affects:** E-11
**Reset:** re-selected "All statuses", confirmed 84 rows
**Registry:** NEW
**Locator:** `this.element.locator("[data-aid='status-filter']")`
**Locator-pw:** `getByRole('combobox', { name: 'Status' })`
**Locator-agree:** no — project convention is data-aid first; both resolve to the same node
**Status:** probed
```

`Observed` in that block is what a real probe produces: what appeared, what request fired, what
count changed. "Opens a dropdown" is not an observation — it is a restatement of the element's
name and will not survive review.

## Section 4 — `## Component tree`

A nested markdown list. Two spaces of indent per level. Each line:

```
- **ClassName** → `path/to/File.ts` [NEW]
- **ClassName** → `path/to/File.ts` [REUSE ExistingClass]
- **ClassName** → `path/to/File.ts` [NEW] (opened by E-07)
```

The `[NEW]` / `[REUSE <Class>]` marker is required. A parenthetical note is optional and is where
you record what opens a dialog. Nesting mirrors real UI nesting — see `rules/component.md`.

## Section 5 — `## Output manifest`

A four-column table, exactly these headers:

```md
| File | Class | Kind | Status |
|---|---|---|---|
| src/pages/EmployeesPage.ts | EmployeesPage | page | planned |
| src/components/EmployeeFilterPanel.ts | EmployeeFilterPanel | component | planned |
```

`Kind` is `page` or `component`. `Status` is `planned` → `written` → `verified`, or
`skipped-reuse` for a `[REUSE]` tree entry that needs no new file.

## Optional section — `## Delta`

Written by re-analysis only, placed immediately after `## Meta`. Lists what changed versus the
previous run of this same file:

```md
## Delta
**Against:** 2026-08-01T09:14:00Z
**Added:** E-22 (bulk-action toolbar button), E-23
**Removed:** E-09
**Changed:** E-04 (options 4 -> 6), E-11 (column added)
**Unchanged:** 18 elements
```

---

## Validator

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" [--phase=<phase>] [--json] <path>
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --self-test
```

`<path>` is the analysis directory or the `analysis.md` itself. `--phase` defaults to the `Phase:`
field in the file. Passing `--phase` explicitly runs that phase's rule set regardless — this is
how a checkpoint validates work-in-progress.

**Exit codes:** `0` clean · `1` errors · `2` warnings only.

`/pom-generate` **stops on exit 1** and writes nothing. On exit 2 it reports the warnings and
proceeds — a `blocked-safety` element is a decision the user already made, not a defect.

### Rules

Each rule applies from the phase listed and at every later phase.

| ID | From phase | Rule |
|---|---|---|
| V001 | survey | First line is `# Analysis: <name>`; second is `<!-- pom-generator/analysis v1 -->` |
| V002 | survey | The five sections exist, exactly once each, in the defined order |
| V003 | survey | Every field line parses as `**Name:** value`; every field name is known |
| V004 | survey | Every block header matches `### (R\|E)-\d{2,} — <name>`; IDs unique |
| V010 | probed | No element has `Status: pending` |
| V011 | probed | Every `Kind: actionable` element's `Probe:` starts with a legal action verb. **`Observed` is rejected** |
| V012 | probed | Every `Kind: actionable` element has a non-empty `Observed:` of at least 20 characters |
| V013 | survey | Every `Type:` exists in `catalog/index.md` |
| V014 | survey | `Kind: static` requires `Status: static-confirmed`; `Kind: actionable` forbids it |
| V015 | probed | Every `Kind: actionable` element has two `Shots:` paths, and both files exist on disk |
| V016 | probed | Every `Kind: actionable` element has a non-empty `Reset:` |
| V020 | survey | Every element's `Region:` resolves to a region block |
| V021 | survey | Every ID in a region's `Contains:` resolves to an element block |
| V022 | decomposed | Every ID in `Reveals:` resolves to an element block or a `C-nn` region |
| V023 | decomposed | Every `C-nn` in `Reveals:` appears in the component tree |
| V024 | survey | Every ID in `Affects:` resolves |
| V025 | survey | Element↔region membership is consistent both ways: if `E-04` says `Region: R-02`, then `R-02`'s `Contains:` includes `E-04` |
| **V030** | probed | **Any element whose `Observed:` mentions a dialog, modal, drawer, popup, popover, or sheet MUST have a `Reveals:`, and every `C-nn` it reveals MUST have a row in the output manifest** |
| V031 | probed | Any element whose `Observed:` mentions a dropdown, listbox, menu, autocomplete or suggestion list must have a `Reveals:` |
| V040 | classified | Every `Locator:` on an element belonging to a component starts with `this.element` |
| V041 | classified | No `Locator:` inside a component contains `page.` |
| V042 | classified | `Locator-agree: no` is followed by ` — ` and a reason |
| V050 | decomposed | Every component-tree entry not marked `[REUSE]` has an output-manifest row |
| V051 | survey | Every region's `Contains:` is non-empty |
| V052 | decomposed | Every element belongs to a component or is explicitly listed as page-level in the tree |
| V060 | generated | Every manifest row has `Status: written` or `verified` or `skipped-reuse` |

### Warnings

| ID | Warning |
|---|---|
| W001 | An element has a `blocked-*` status — reported so the gap is visible, never hidden |
| W002 | `Locator-agree: no` — the hand-authored and Playwright-generated locators disagree |
| W003 | `Type:` is an `other/*` fallback — a candidate for a new catalog entry |
| W004 | A region contains more than 15 elements — it probably needs decomposing further |
| W005 | An element has `Registry: NEW` but its `DOM:` closely matches an existing registry entry |

### Output

Grouped by rule, with `analysis.md:<line>` references:

```
V011  actionable element must have a real probe action           2 errors
  analysis.md:112  E-09 "Export button"   Probe: "Observed"
  analysis.md:147  E-14 "Column settings" Probe: "Observed"

V030  dialog revealed but no component file planned              1 error
  analysis.md:88   E-07 "Create employee" reveals a dialog; no C-nn in Reveals:

3 errors, 0 warnings  (phase: probed)
```
