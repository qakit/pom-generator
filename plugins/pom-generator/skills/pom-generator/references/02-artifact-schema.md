# Artifact schema: `analysis.md` (v2)

This is the contract between `/pom-analyze` (which writes it) and `/pom-generate` (which reads it
and writes no code unless it validates). The grammar is strict because a validator parses it —
see "Validator" at the end.

Location: `.pom-generator/analysis/<slug>/analysis.md`, with any screenshots in `./screens/`.
One file per page. Flows link several of these together; they do not merge them.

**v2 is recognition-first.** Most elements never get probed: they are matched against the
component registry's fingerprints (`Status: recognized`) or answered by the DOM itself
(`Probe: Read …`). Interaction is reserved for the short list of controls whose behaviour is
genuinely unknown. That is what keeps a page in the tens of tool calls, not the hundreds.

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
6. **Multi-value fields** (`Contains`, `Reveals`, `Affects`) are comma-separated.
   Empty means the field is omitted entirely, not left blank.
7. **The file is updated after every probe.** It is the durable state of the run, not a report
   written at the end. A crash or a context compaction costs one element, not the run.

---

## Section 1 — `## Meta`

| Field | Required | Value |
|---|---|---|
| `URL` | always | Full URL analyzed |
| `Slug` | always | Directory slug (see `01-glossary.md`) |
| `Analyzed` | always | ISO 8601 timestamp of the run that last touched this file |
| `Viewport` | always | `WIDTHxHEIGHT`, e.g. `1440x900` |
| `Baseline` | always | Path to the full-page baseline screenshot |
| `Phase` | always | `inventory` \| `probed` \| `classified` \| `generated` |
| `Conventions` | optional | Marker for which `conventions.md` version this was analyzed against |
| `Selector-strategy` | from inventory | Ordered list of what this app can be located by, measured not assumed. See `04-selectors.md` |
| `Tools-degraded` | optional | MCP tools found unavailable at preflight, comma-separated |
| `Notes` | optional | Free text |

`Phase` advances only when that phase's validator run passes. It is the resume point: a run that
finds `Phase: inventory` (approved at the checkpoint) goes straight to draining the probe queue.

## Section 2 — `## Regions`

One `### R-nn — Name` block per area — the visually distinct areas of the baseline page, plus one
region per container revealed during probing (so its children have somewhere to live).

| Field | Required | Value |
|---|---|---|
| `Root` | always | Backticked selector for the region's container |
| `Resolves` | always | How many nodes `Root` matched on the live page. See "Grounding" |
| `Contains` | always | Comma-separated `E-nn` IDs. Must be non-empty |
| `Box` | optional | `x,y,w,h` in CSS pixels, if measured |
| `Shot` | optional | Path to a region crop, if one was taken |
| `Component` | revealed regions | `C-nn` if this region is a component revealed during probing |
| `Open-path` | revealed regions | How to bring it into existence, e.g. `click E-07 (group-open-btn)`. Required whenever `Component:` is present (V081) |
| `Coverage` | classified | `claimed/found` — interactive nodes the coverage script found under `Root`, versus how many this region's elements account for (V085). See `03-toolbelt.md` |
| `Notes` | optional | Free text |

`Open-path` is what lets the generated opener method, and any future re-analysis, reproduce the
state. A dialog nobody knows how to open is a wrapper nobody can verify.

## Section 3 — `## Elements`

One `### E-nn — Name` block per element. Fields become required as the phase advances.

| Field | Required from phase | Value |
|---|---|---|
| `Region` | inventory | The `R-nn` this element belongs to |
| `Scope` | inventory | What this element is located *inside*: `page`, an `R-nn`, or a container `E-nn`. See "Scope" |
| `Selector` | inventory | Backticked raw selector — CSS or XPath, no language. This is the string that gets grounded |
| `Resolves` | inventory | How many nodes `Selector` matched, counted inside `Scope`. See "Grounding" |
| `Kind` | inventory | `actionable` \| `static` \| `container` |
| `Type` | inventory | A type id from `catalog/index.md` |
| `Registry` | inventory (actionable, container) | The existing wrapper class this matches, or `NEW` |
| `Status` | inventory | See `01-glossary.md`. `pending` only for elements awaiting a probe |
| `Text` | recommended | The visible text, label, placeholder, or tooltip that identifies it to a human |
| `DOM` | optional | Backticked tag plus the role and data attributes that matter |
| `Box` | optional | `x,y,w,h` in CSS pixels, if measured |
| `Class` | when grouped | A short id naming an equivalence class of identical unknowns, e.g. `row-arrow` |
| `Class-ref` | when `Status: probed-by-class` | The `E-nn` that was probed and whose outcome this one inherits |
| `Probe` | probed (`Status: probed` only) | Action verb + what was done — or `Read <attribute>` where the DOM already answers |
| `Value-source` | probed (`Typed` only) | Where the typed value came from: `page-data`, `constraint`, `label`, `synthetic`. See `05-probe-values.md` |
| `Evidence` | probed (`Status: probed` only) | Raw tool output the conclusion rests on, pasted not paraphrased: `diff:`, `net:`, `url:`, `attr:`, `value:`, `console:` tokens (V082) |
| `Observed` | probed (`Status: probed` only) | What actually changed, restating the Evidence in prose. Concrete and specific — and never claiming more than the Evidence shows |
| `Open-path` | revealed elements | How to reach an element that does not exist at baseline, e.g. `type into E-04, then` |
| `Reveals` | when applicable | `C-nn` / `E-nn` IDs this interaction brought into existence |
| `Affects` | when applicable | IDs of other elements this one changes |
| `Locator` | classified | Backticked, rooted at `this.element` for component-owned elements |
| `Notes` | optional | Free text |

### Status decides what an element owes

| Status | Owes | Never owes |
|---|---|---|
| `recognized` | `Registry: <Class>` naming a real registry entry (V080) | Probe, Observed |
| `probed` | `Probe:` with a legal verb (V011), an `Evidence:` line pasted from tool output (V082), and a substantive `Observed:` (V012) | — |
| `probed-by-class` | `Class:` and `Class-ref:` to a probed member (V017, V018) | its own Probe |
| `static-confirmed` | `Kind: static` (V014) | Registry, Probe |
| `blocked-*` | a reason in the status itself; surfaced as W001 | Probe, Observed |
| `pending` | a probe, before the run can finish (V010) | — |
| `removed` | `Resolves: 0` against a fresh load, and a `## Delta` entry (V061) | everything else |

**`recognized` is the normal outcome**, not a shortcut. The registry fingerprint identified the
component; its behaviour is already documented in `component-registry.md`; probing it again would
re-learn what the codebase already knows. The probe queue is for what recognition could *not*
answer.

**`Probe: Read …` is the evidence probe, and it is narrow.** A link with a real `href`, or a
container whose *structure* is being recorded — the markup states the answer and
`Read href="/timeoff/archive"` records where it came from. It is refused (V019) for everything
else actionable — every input, select, checkbox, **and every button, including icon buttons** —
and for anything with a `Reveals:`. What a select does is only observable by selecting; what a
button does is only observable by clicking. A `Read` probe's `Observed:` may state what the
markup says and nothing more: "triggers a download", "opens the user menu" from attributes
alone is a prediction dressed as an observation, and V083 rejects it.

### Evidence is pasted, not written

`Evidence:` exists because a formatted field can be filled with plausible fiction, and nothing
downstream can tell. It holds the raw facts the tools returned — the diff summary, the request
log, the attribute value — in compact `marker: value` tokens:

```md
**Evidence:** diff: +1 node [role='dialog'] aria-modal at document.body; net: none; url: unchanged
```

`Observed:` then narrates what the Evidence shows. The direction matters: conclusions come
*from* evidence. If there is no diff output, no request, no attribute to paste, there was no
probe, and the element is still `pending`.

**When the validator rejects a block, fix the data, never the wording.** V030 firing on "a
dialog opened" is not a request to write "an overlay appeared" — it is a statement that a
component is missing from `Reveals:`. Rewording an observation until a rule stops firing makes
the artifact pass validation while describing a page that does not exist; it is the single most
destructive way to respond to this validator.

### Scope

A Page Object locates from the component that owns it, never from the document. So a selector
means nothing on its own — it means something *inside a frame*, and `Scope:` names that frame.

Scopes nest the way the UI nests: a cell is scoped to its row, the row to the table, the table to
the panel that holds it, the panel to the page.

**`Scope:` is ownership, not visual containment.** It answers "what locates me?". The practical
test: the scope is whichever class will hold this element's getter. If that is the page class, the
scope is `page`.

Overlays are the case worth knowing: a dialog, menu or listbox usually renders through a portal at
the document root, so its region's `Root:` is page-rooted even though it visually sits on top of
something else. Regions therefore carry no `Scope:` field — they are always resolved from the
document.

`Scope:` does three jobs:

1. **It is the frame `Resolves:` is counted in.** A cell selector asked of the document returns
   one match per row; asked of a row it returns one. The second number is the one the generated
   wrapper will actually see.
2. **It decides the locator root.** `Scope: page` → the page root (`this.page`, `self.page`).
   Anything else → the component root (`this.element`, `self.element`, `self._root` — whatever this
   project calls it). V041 rejects a scoped element that roots at the page.
3. **It bounds the diff when the element is probed** (`analyze/probe.md`) — together with the
   portal layer, which is checked on every probe regardless of scope.

V046 checks the scope resolves, V047 that the chain reaches `page` without looping, and V048 that
the target is a container in the same region.

### Grounding

`Selector`, `Resolves` and, when present, `Box` are the fields that can be *checked*, and they
exist because a fabricated selector is otherwise indistinguishable from a real one until the
generated code fails — which is much later and much more expensive.

**`Selector` is language-neutral on purpose.** It holds the raw CSS or XPath string; `Locator`
holds the expression that gets written into the wrapper, in whatever language the project uses.
One is checkable against a DOM by anything that can parse a DOM. W007 fires when `Locator` passes
a raw selector string that `Selector` never grounded.

**`Resolves` is the match count the page gave back, counted inside `Scope:`.** Not an estimate —
the number the run got when it asked. `0` is V044: the selector describes nothing inside the frame
it claims to live in. Greater than `1` is V045 unless the element is a `container` or carries a
`Class:` — a row, a card, an option is *supposed* to repeat and is reached by index or text at
runtime; anything else at 2 or more is a wrapper that silently takes the first match.

All of it comes from one `browser_evaluate` over the whole selector list, not one call per element
— see `03-toolbelt.md`.

### Equivalence classes

For repeated **unknowns** — several controls that share a type, a container, a class stem or
`data-*` prefix, and a handler — declare a `Class:`, probe one member, and give the rest
`Status: probed-by-class` with a `Class-ref:` naming the one that did the work. V017 refuses a
class where nobody was probed; V018 refuses an inherited outcome with nothing to inherit from.

Sharing a *shape* is not sharing a class: two identical-looking icon buttons in one toolbar are
routinely a navigation and a dialog opener. Membership is a claim about markup and handler.

### A worked block

```md
### E-04 — Status filter
**Region:** R-02
**Scope:** R-02
**Text:** "All statuses"
**DOM:** `div[data-aid='status-filter']` role=combobox aria-haspopup=listbox
**Selector:** `[data-aid='status-filter']`
**Resolves:** 1
**Kind:** actionable
**Type:** selection/single-select
**Registry:** NEW
**Probe:** Selected "Active"
**Evidence:** diff: +1 node [role='listbox'] at document.body (4 options); net: GET /api/employees?status=active; diff: rows 84 -> 31
**Observed:** listbox opened as a portal at body (4 options: All, Active, Suspended, Archived); on select, GET /api/employees?status=active fired; table went 84 -> 31 rows
**Reveals:** C-02
**Affects:** E-11
**Locator:** `this.element.locator("[data-aid='status-filter']")`
**Status:** probed
```

And the recognized case, which should be most of the file:

```md
### E-03 — Employee search
**Region:** R-02
**Scope:** R-02
**Text:** "Сотрудник или команда"
**Selector:** `[data-aid='search-combobox']`
**Resolves:** 1
**Kind:** actionable
**Type:** inputs/autocomplete
**Registry:** SearchCombobox
**Status:** recognized
**Locator:** `this.element.locator("[data-aid='search-combobox']")`
```

`Observed` in the first block is what a real probe produces: what appeared, what request fired,
what count changed. "Opens a dropdown" is not an observation — it restates the element's name.

## Section 4 — `## Component tree`

A nested markdown list. Two spaces of indent per level. Each line:

```
- **ClassName** → `path/to/File.ts` [NEW]
- **ClassName** → `path/to/File.ts` [REUSE ExistingClass]
- **ClassName** → `path/to/File.ts` [NEW] (opened by E-07)
```

The `[NEW]` / `[REUSE <Class>]` marker is required. For every `[NEW]` component entry the
parenthetical note is **not** optional: it must name the `R-nn`, `C-nn` or container `E-nn` that
is the component's root (V084). A component with no recorded root has no selector, and its whole
structure would have to be invented at generation time — which is exactly what V084 exists to
prevent. Nesting mirrors real UI nesting — see `rules/component.md`.

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
field in the file. Passing `--phase` explicitly runs that phase's rule set regardless.

**Exit codes:** `0` clean · `1` errors · `2` warnings only.

`/pom-generate` **stops on exit 1** and writes nothing. On exit 2 it reports the warnings and
proceeds — a `blocked-safety` element is a decision the user already made, not a defect.

A second gate runs *after* code is written: `scripts/verify-generated.mjs` cross-checks every
selector in the generated files against this artifact (closed world — see `generate/emit.md`).
The two scripts bracket generation: nothing ungrounded goes in, nothing invented comes out.

### Rules

Each rule applies from the phase listed and at every later phase.

| ID | From phase | Rule |
|---|---|---|
| V001 | inventory | First line is `# Analysis: <name>`; second is `<!-- pom-generator/analysis v2 -->` |
| V002 | inventory | The five sections exist, exactly once each, in the defined order |
| V003 | inventory | Every field line parses as `**Name:** value`; every field name is known; required fields present |
| V004 | inventory | Every block header matches `### (R\|E)-\d{2,} — <name>`; IDs unique |
| V010 | probed | No element has `Status: pending` |
| V011 | probed | Every `Status: probed` element's `Probe:` starts with a legal action verb — and, for a type with a required action, **that** verb. Opening a select and closing it is `Clicked`, which is not a probe of a select |
| V012 | probed | Every `Status: probed` element has a non-empty `Observed:` of at least 20 characters |
| V013 | inventory | Every `Type:` exists in `catalog/index.md` |
| V014 | inventory | `Kind: static` requires `Status: static-confirmed`; `Kind: actionable` forbids it |
| V017 | probed | Every `Class:` has at least one member with `Status: probed` |
| V018 | probed | `Status: probed-by-class` requires `Class-ref:` resolving to a probed member of the same class |
| V019 | probed | `Probe: Read` is allowed only for `actions/link`, containers, and `other/*` — every other actionable type, **buttons included**, is only observable by interacting. Also refused for anything with `Reveals:` |
| V020 | inventory | Every element's `Region:` resolves to a region block |
| V021 | inventory | Every ID in a region's `Contains:` resolves to an element block |
| V022 | probed | Every ID in `Reveals:` resolves to an element block or a `C-nn` region |
| V023 | probed | Every `C-nn` in `Reveals:` appears in the component tree |
| V024 | inventory | Every ID in `Affects:` resolves |
| V025 | inventory | Element↔region membership is consistent both ways |
| **V030** | probed | **Any element whose `Observed:` says a dialog, modal, drawer, popup, popover, sheet or overlay *appeared* MUST have a `C-nn` in `Reveals:`. Fixed by recording the component — never by rewording the observation** |
| V031 | probed | Any element whose `Observed:` says a dropdown, listbox, menu, autocomplete or suggestion list *appeared* must have a `Reveals:`. Same fix discipline as V030 |
| V040 | classified | Every `Locator:` hangs off a recognisable root — `this.<name>` or `self.<name>` |
| V041 | classified | An element whose `Scope:` is not `page` must not root at the page, and must not reach a page handle inside its body |
| V043 | inventory | `Resolves:` is a whole number — the count the live page returned |
| V044 | inventory | `Resolves: 0` — the selector matched nothing on the page it describes |
| V045 | inventory | `Resolves:` > 1 requires `Kind: container` or a `Class:` |
| V046 | inventory | `Scope:` is `page`, an existing region, or an existing element |
| V047 | inventory | The scope chain reaches `page` without looping |
| V048 | inventory | A scope target is a `Kind: container` in the same region as the element it scopes |
| V049 | probed | A `Probe:` beginning `Typed` records a legal `Value-source:` |
| V050 | inventory | Every component-tree entry not marked `[REUSE]` has an output-manifest row |
| V051 | inventory | Every region's `Contains:` is non-empty |
| V052 | inventory | Every region is referenced by a component-tree entry or marked page-level in `Notes:` |
| V060 | generated | Every manifest row has `Status: written` or `verified` or `skipped-reuse` |
| V061 | probed | `Status: removed` requires `Resolves: 0` against a fresh load **and** an entry in the `## Delta`'s `Removed:` |
| V071 | inventory | `Box:`, when present, parses as `x,y,w,h` with a positive width and height |
| **V080** | inventory | **`Status: recognized` requires `Registry:` naming a real class — `NEW` and empty are refused. Recognition without a registry match is a guess** |
| **V081** | probed | **A region carrying `Component:` (a revealed container) must record `Open-path:` — a dialog nobody knows how to open cannot be verified** |
| **V082** | probed | **Every `Status: probed` element has an `Evidence:` line carrying at least one `diff:`/`net:`/`url:`/`attr:`/`value:`/`console:` token — pasted tool output, not a confident sentence** |
| **V083** | probed | **A `Read` probe's `Observed:` must not claim behaviour ("opens", "triggers", "downloads"…) — from attributes alone that is a prediction. Interact, or strip the claim** |
| **V084** | inventory | **Every `[NEW]` component tree entry (except the page) names its root `R-nn`/`C-nn`/`E-nn` in the parenthetical, and that ID resolves** |
| **V085** | classified | **Every region records `Coverage: claimed/found` from the coverage script, and claims at least as many interactive nodes as were found under its root** |

### Warnings

| ID | Warning |
|---|---|
| W001 | An element has a `blocked-*` status — reported so the gap is visible, never hidden |
| W003 | `Type:` is an `other/*` fallback — a candidate for a new catalog entry |
| W004 | A region contains more than 15 elements — it probably needs decomposing further |
| W005 | An element has `Registry: NEW` but the same `Type:` was already wrapped elsewhere in this run |
| W007 | `Locator:` selects on a raw string that `Selector:` did not ground |
| W009 | A control that matches against real data was probed with `Value-source: synthetic`, which cannot have matched |
| W010 | `Selector:` rests on a framework- or build-generated value. Reload and compare (`04-selectors.md` S1) |
| W011 | A `Kind: container` element is `Registry: NEW` with no `Notes:` — nothing on record shows the registry was actually checked |

### Output

Grouped by rule, with `analysis.md:<line>` references:

```
V011  probed element must have a real probe action                 2 errors
  analysis.md:112  E-09 "Export button"   Probe: "Observed"
  analysis.md:147  E-14 "Column settings" Probe: "Observed"

V030  dialog revealed but no component file planned                1 error
  analysis.md:88   E-07 "Create employee" reveals a dialog; no C-nn in Reveals:

2 errors, 0 warnings  (phase: probed)
```
