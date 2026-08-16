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
| `Selector-strategy` | from survey | Ordered list of what this app can be located by, measured not assumed. See `04-selectors.md` |
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
| `Scope` | survey | What this element is located *inside*: `page`, an `R-nn`, or a container `E-nn`. See "Scope" |
| `Visual` | survey | What it looks like, taken from the screenshot — shape, colour, iconography, position. Written *before* the DOM is consulted |
| `Snapshot-ref` | optional | The accessibility snapshot handle (`e47`) **for the current run only**. See below |
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
| `Value-source` | probed (`Typed` only) | Where the typed value came from: `page-data`, `constraint`, `label`, `synthetic`. See `05-probe-values.md` |
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

### Why `Snapshot-ref` is optional and identifies nothing

`browser_snapshot` returns nodes tagged `[ref=e47]`, and those handles are how you tell the MCP
server which element to act on. They are the server's own bookkeeping: they do not exist in the
DOM, nothing can query for them, and they are reissued on every snapshot and every session. The
same button is `e47` now and something else after a reload.

They were once required on every element, from a time when the artifact was a scratchpad that
lived inside one run. That is no longer what this file is. A handle written into a committed
document is meaningless the moment the session ends, and a resume that tries to re-bind against
one finds nothing — which reads, wrongly, as *the page has changed*.

So: record it if it helps you within the run, and **never treat it as identity**. Identity is
`Selector` + `Resolves` + `Box`, all three of which describe the page rather than the tooling and
all three of which still mean something next week. Resume re-binds by selector
(`analyze/pipeline.md`).

### Scope

A Page Object locates from the component that owns it, never from the document. So a selector
means nothing on its own — it means something *inside a frame*, and `Scope:` names that frame.

Scopes nest the way the UI nests: a cell is scoped to its row, the row to the table, the table to
the panel that holds it, the panel to the page.

**`Scope:` is ownership, not visual containment.** It answers "what locates me?", which is not
always "what am I drawn inside?". An element that the page class owns — a title, a breadcrumb, a
table that was extracted as its own component — has `Scope: page` even though it sits visually
within a region. `Region:` records where it appears; `Scope:` records what it hangs off. They match
for most elements and diverge exactly where a region was not turned into a component, which is
information worth having explicit.

The practical test: the scope is whichever class will hold this element's getter. If that is the
page class, the scope is `page`.

Overlays are the other case worth knowing: a dialog or a menu usually renders through a portal at
the document root, so its region's `Root:` is page-rooted even though it visually sits on top of
something else. Regions therefore carry no `Scope:` field — they are always resolved from the
document.

`Scope:` does three jobs, which is why it is one field and not three:

1. **It is the frame `Resolves:` is counted in** (see below). A cell selector asked of the
   document returns one match per row; asked of a row it returns one. The second number is the one
   the generated wrapper will actually see.
2. **It decides the locator root.** `Scope: page` → the page root (`this.page`, `self.page`).
   Anything else → the component root (`this.element`, `self.element`, `self._root` — whatever this
   project calls it). V041 rejects a scoped element that roots at the page, which is the defect
   that breaks a component the moment it is reused elsewhere.
3. **It is the subtree that gets diffed when the element is probed** (`analyze/p3-probe.md`). What
   appeared or disappeared *inside the dialog* after a value was selected is the observation; what
   changed elsewhere on the page is `Affects:`.

V046 checks the scope resolves, V047 that the chain reaches `page` without looping, and V048 that
the target is a container in the same region — you cannot scope an element inside a button, and a
scope that crosses a region boundary means one of the two is filed wrong.

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

**`Resolves` is the match count the page gave back, counted inside `Scope:`.** Not an estimate,
not an expectation — the number the run got when it asked. `0` is V044: the selector describes
nothing inside the frame it claims to live in. Greater than `1` is V045 unless the element is a
`container` or carries a `Class:` — a row, a card, an option is *supposed* to repeat and is reached
by index or text at runtime; anything else at 2 or more is a wrapper that silently takes the first
match.

Counting inside the scope is what keeps this rule from fighting selector proximity
(`rules/element.md` E7). Counted against the document, a perfectly good cell selector looks
ambiguous, and the only way to "fix" it is to make it page-absolute — which is the defect, not the
remedy.

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
**Scope:** R-02
**Visual:** pill-shaped control, grey border, chevron on the right, reads "All statuses"
**Snapshot-ref:** e47
**Notes:** the ref is this run's MCP handle, kept as a convenience; identity is the Selector
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
| V011 | probed | Every `Kind: actionable` element's `Probe:` starts with a legal action verb — and, for a type whose catalog entry names a required action, **that** verb. Opening a select and closing it is `Clicked`, which is a legal verb and not a probe of a select. **`Observed` is rejected** |
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
| V040 | classified | Every `Locator:` hangs off a recognisable root — `this.<name>` or `self.<name>`, so a Python wrapper validates the same as a TypeScript one |
| V041 | classified | An element whose `Scope:` is not `page` must not root at the page, and must not reach a page handle inside its body |
| V046 | survey | `Scope:` is `page`, an existing region, or an existing element |
| V047 | survey | The scope chain reaches `page` without looping |
| V048 | survey | A scope target is a `Kind: container` in the same region as the element it scopes |
| V049 | probed | A `Probe:` beginning `Typed` records a legal `Value-source:` |
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
| V061 | probed | `Status: removed` requires `Resolves: 0` against a fresh load **and** an entry in the `## Delta`'s `Removed:` — an element cannot be deleted by assertion |

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
| W009 | A control that matches against real data was probed with `Value-source: synthetic`, which cannot have matched |
| W010 | `Selector:` rests on a framework- or build-generated value. Reload and compare (`04-selectors.md` S1) |

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
