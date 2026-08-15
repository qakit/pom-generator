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
| `Budget` | from Gate 1 | Tool-call ceiling the user approved, e.g. `190 tool calls` |
| `Spent` | during P3 | Tool calls used so far. Exceeding `Budget` is W006 |
| `Notes` | optional | Free text |

`Phase` advances only when that phase's validator run passes. It is the resume point: a run that
finds `Phase: decomposed` skips P1 and P2 and goes straight to draining the probe queue.

## Section 2 — `## Regions`

One `### R-nn — Name` block per visually distinct area found during survey.

| Field | Required | Value |
|---|---|---|
| `Root` | always | Backticked selector for the region's container |
| `Resolves` | always | How many nodes `Root` matched on the live page. See "Grounding" |
| `Box` | always | `x,y,w,h` of `Root` in CSS pixels, as measured |
| `Shot` | always | Path to the region screenshot. Must exist (V070) and match `Box` (V072) |
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
| `Selector` | survey | Backticked raw selector — CSS or XPath, no language. This is the string that gets grounded |
| `Resolves` | survey | How many nodes `Selector` matched on the live page. See "Grounding" |
| `Box` | survey | `x,y,w,h` in CSS pixels, as measured |
| `Kind` | survey | `actionable` \| `static` \| `container` |
| `Type` | survey | A type id from `catalog/index.md` |
| `Tier` | survey (actionable only) | `full` \| `class` \| `evidence` — how much evidence this element's conclusion may rest on. See below |
| `Class` | when `Tier: class` | A short id naming the equivalence class, e.g. `status-option` |
| `Class-ref` | when `Status: probed-by-class` | The `E-nn` that was probed in full and whose outcome this one inherits |
| `Status` | survey | See `01-glossary.md`. Starts as `pending` |
| `Probe` | probed | Action verb + what was done. `Observed` is illegal here |
| `Observed` | probed | What actually changed. Concrete and specific |
| `Shots` | probed (`Tier: full`/`class` only) | `before.png, after.png` paths |
| `Reset` | probed (`Tier: full`/`class` only) | How baseline state was restored |
| `Reveals` | when applicable | `C-nn` / `E-nn` IDs this interaction brought into existence |
| `Affects` | when applicable | IDs of other elements this one changes |
| `Registry` | classified | `NEW` or the name of the existing wrapper class that matches |
| `Locator` | classified | Backticked, rooted at `this.element` for component-owned elements |
| `Locator-pw` | classified | What `browser_generate_locator` returned |
| `Locator-agree` | classified | `yes`, or `no — <reason>` |
| `Notes` | optional | Free text |

### Grounding

Every other field in this schema is a description. `Selector`, `Resolves` and `Box` are the three
that can be *checked*, and they exist because a fabricated selector is otherwise indistinguishable
from a real one until the generated code fails — which is much later and much more expensive.

**`Selector` is language-neutral on purpose.** It holds the raw CSS or XPath string;
`Locator` holds the expression that gets written into the wrapper, in whatever language the
project uses (`this.element.locator(...)`, `self.element.locator(...)`). One is checkable against
a DOM by anything that can parse a DOM; the other is checkable only by a type-checker. Keeping
them apart is what lets the grounding pass work for a Python project and a TypeScript one alike.

W007 fires when `Locator` passes a raw selector string that isn't the one `Selector` grounded — the
case where a selector gets copied out of `component-registry.md` and into generated code without
ever having touched the page. A role- or label-based locator is exempt: it is a different
expression of the same node, which is what `Locator-pw` is for.

**`Resolves` is the match count the page gave back.** Not an estimate, not a expectation — the
number the run got when it asked. `0` is V044: the selector describes nothing on the page it
claims to come from. Greater than `1` is V045 unless the element is a `container` or carries a
`Class:`, because an ambiguous selector generates a wrapper that silently picks the first match.

**`Box` is what makes "read the screenshot" enforceable.** It is the element's measured geometry,
and V072 checks the referenced PNG's pixel dimensions against it (allowing for device pixel ratio).
A crop of the wrong node, or of a node whose bounding box spans the entire scroll height, produces
an image that does not show what its caption claims — and every conclusion drawn from that image is
unfounded, invisibly. W008 additionally flags a region taller than twice the viewport: technically
a correct crop, practically an unreadable one, and a sign the region needs decomposing.

Both come from one `browser_evaluate` over the whole selector list, not one call per element —
see `03-toolbelt.md`.

### Tiers

`Tier` is assigned during survey, before anything is probed, because it is what the Gate 1 cost
estimate is built from. Deciding it later means deciding it after the cost has been paid.

| Tier | What it buys | What it costs | Legal for |
|---|---|---|---|
| `full` | the whole P3 procedure — before shot, action, after shot, network and console diff, reset | ~10 tool calls | anything |
| `class` | one member probed `full`; siblings inherit its outcome and name it | ~10 calls for the class, ~1 each after | members of a genuine equivalence class |
| `evidence` | no interaction; the conclusion is read off attributes the DOM already carries | ~0 extra calls | see the restriction below |

**`Tier: evidence` is deliberately hard to reach** (V019). It is illegal for `inputs/*`,
`selection/*`, `temporal/*` and `collections/*`, and illegal for anything with a `Reveals:`.
What a select does depends on what happens when you select; a field that only appears on the third
option is invisible to any amount of DOM reading. The tier exists for the case where the markup
genuinely states the answer — an `<a href>` that navigates, a `disabled` attribute — and its probe
verb is `Read`, which is legal at no other tier.

**A class is a claim about sameness and V017 makes you back it.** At least one member must reach
`Status: probed`; a class where everybody inherited is a class where nothing was observed. The
inheriting members carry `Status: probed-by-class` and a `Class-ref:` pointing at the member that
did the work, so the extrapolation is declared rather than silent (`rules/element.md` E3).

Two elements are in the same class only if they share a type, a container, a class stem or
`data-*` prefix, and a handler. Sharing a *shape* is not sharing a class — two identical-looking
icon buttons in the same toolbar routinely do unrelated things.

### A worked block

```md
### E-04 — Status filter
**Region:** R-02
**Visual:** pill-shaped control, grey border, chevron on the right, reads "All statuses"
**Snapshot-ref:** e47
**DOM:** `div[class*='_select_']` role=combobox aria-haspopup=listbox
**Selector:** `[data-aid='status-filter']`
**Resolves:** 1
**Box:** 24,84,180,40
**Kind:** actionable
**Type:** selection/single-select
**Tier:** full
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
| V017 | probed | Every `Class:` has at least one member with `Status: probed` |
| V018 | probed | `Status: probed-by-class` requires `Class-ref:` resolving to a probed member of the same class |
| V019 | survey | `Tier:` is legal for the element: `evidence` is refused for `inputs/*`, `selection/*`, `temporal/*`, `collections/*` and for anything with `Reveals:` |
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
| V043 | survey | `Resolves:` is a whole number — the count the live page returned |
| V044 | survey | `Resolves: 0` — the selector matched nothing on the page it describes |
| V045 | survey | `Resolves:` > 1 requires `Kind: container` or a `Class:`; an ambiguous selector silently picks the first match |
| V070 | survey | Every region's `Shot:` file exists on disk |
| V071 | survey | `Box:` parses as `x,y,w,h` with a positive width and height |
| V072 | survey | The screenshot's pixel dimensions match its `Box:` at some device pixel ratio |
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
| W006 | `Meta.Spent` exceeds the `Meta.Budget` approved at Gate 1 |
| W007 | `Locator:` selects on a raw string that `Selector:` did not ground |
| W008 | A region's `Box:` is more than twice the viewport height — the crop is unreadable and the region needs decomposing |

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
