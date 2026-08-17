# P1 — Inventory

**Goal:** every element on the page is in the artifact, and as many as possible leave this phase
already answered — `recognized` against the registry, `probed` by reading the DOM, or
`static-confirmed`. What remains `pending` is the probe list.
**Produces:** `## Regions`, `## Elements`, `## Component tree`, `## Output manifest`.
**Ends at:** the checkpoint.

This phase is almost entirely bulk work: one screenshot, two or three `browser_evaluate` calls
over the whole page, and reasoning over their output. There are no per-element browser calls here.

---

## Steps

### 1. Baseline screenshot, and the region split

```
browser_take_screenshot  fullPage: true  filename: screens/baseline.png
```

**Read it as an image** — this is the one screenshot the run always takes, and it is read for two
things: how the page divides into visually distinct areas, and hints about icon-only controls that
the DOM will not explain.

Split the page into regions a person would point at and name: the header, the sidebar, the filter
panel, the results table. Typical count is 3–8. Record it in `Meta.Baseline`.

### 2. Measure what this app can be located by

Run the selector-strategy probe from `03-toolbelt.md`, **twice, with a reload between**. Record
the result in `Meta.Selector-strategy` as an ordered list.

The reload separates a real hook from a framework-minted id that looks identical in a single
snapshot — see `04-selectors.md`, which is the authority on what counts as stable.

**Look at the `unique` score, not just coverage.** A test attribute can be real and still be
*type-level*: an app where 41 buttons all carry `data-aid="icon-button"` has a stable hook that
identifies the component type, not the instance. That is not a defect to work around — it is the
strategy: **type-level hook + scope + text/position**, and it is exactly how the registry
fingerprints match. Record it that way, e.g.:

```
**Selector-strategy:** data-aid (0.61 coverage, type-level — instance identity comes from scope + text) > authored class stem > role+text
```

Cross-check against `conventions.md`. If the existing Page Objects use something else, **the
existing code wins** (`04-selectors.md` S6) — report the mismatch at the checkpoint.

### 3. Bulk extraction

Run the inventory extraction script from `03-toolbelt.md` — one `browser_evaluate` that walks the
whole document and returns every interactive and container element as structured JSON: tag, role,
test hook, text, label/placeholder, href, disabled state, geometry, and the hooked/stemmed
ancestor chain.

This one call replaces per-element inspection. Everything the old pipeline learned from a
screenshot, an evaluate, and a snapshot per element is in this list.

Reconcile it with the region split from step 1: assign every extracted node to a region, find each
region's `Root:` selector (from the ancestor chains, following the measured strategy), and write
the `## Regions` and `## Elements` blocks. For each element:

- `Selector:` per the strategy: instance-unique hook if one exists, else type-level hook scoped by
  its container, else authored class stem, else structure/XPath (`04-selectors.md`)
- `Scope:` the class that will own its getter — follow the containment chain inward
  (`02-artifact-schema.md`)
- `Type:` a hypothesis from `catalog/index.md`, from tag/role/attributes plus the baseline image
- `Text:` the human identity — label, placeholder, visible text, or tooltip

Do not enumerate the cells of a repeating row as page elements. One row is a component and its
cells are that component's accessors — see `rules/component.md` C7. Twenty rows × six cells is not
an inventory of 120 elements.

### 4. Recognize against the registry

**This is the step the whole redesign exists for.** For every element and every candidate
component, match against the `Fingerprint:` lines in `.pom-generator/component-registry.md`
(format: `registry-format.md`):

| Result | Record |
|---|---|
| Fingerprint matches | `Registry: <ClassName>`, `Status: recognized`. **Done — no probe** |
| Nothing matches | `Registry: NEW`, `Status: pending` |
| Close but not identical | `Registry: NEW`, `Status: pending`, plus a `Notes:` line naming what it resembles and how it differs |

The third case is the valuable one — it feeds the registry's "Not to be confused with" field, and
it is worth flagging at the checkpoint so the user can say "no, that *is* a TeamSelect".

A recognized element's behaviour is already documented in the registry; probing it re-learns what
the codebase knows. Trust the match — the user confirms the recognition table at the checkpoint,
which is the safeguard.

### 5. Answer what the DOM already answers

- A link with a real `href` → `Status: probed`, `Probe: Read href`, `Observed:` the destination.
  No click needed (V019 limits this to types whose behaviour the markup can actually state).
- A `disabled` control → note it; it is still an element with a getter.
- Genuinely static text, badges, images → `Kind: static`, `Status: static-confirmed`. If it has a
  role, a handler, or `cursor: pointer` (all in the extraction output), it is not static.

### 6. Group the identical unknowns

Repeated unknown controls that share a type, a container, a class stem or `data-*` prefix — give
them one `Class:` id. One member will be probed; the rest inherit (`Status: probed-by-class`,
`Class-ref:`). Two identical-looking buttons in one toolbar are **not** a class; sameness means
shared markup and handler, both visible in the extraction output.

### 7. Ground everything in one call

Run the grounding pass from `03-toolbelt.md` over every region `Root:` and element `Selector:`,
resolved through its scope chain. Write back `Resolves:` (and `Box:` if you want it).

- `Resolves: 0` → the selector is wrong; fix it and re-ground (V044).
- `Resolves:` > 1 on a non-container without a `Class:` → scope it deeper (V045).

One call checks every selector on the page at once. **A zero is never rounded up** — it means the
selector came from memory, the registry, or a different page, which is precisely the error worth
catching now.

### 8. The second sweep — cheap, and still not optional

The extraction script finds what is in the DOM. This step finds what is not, drawn from what has
actually been missed before:

- **Hover-revealed controls.** Row action buttons that appear on hover are absent from the
  extraction. `browser_hover` over one row of each collection and re-run the extraction diff —
  one hover per collection, not per row.
- **Below-the-fold content.** Compare the extraction's geometry against the viewport; anything at
  y > viewport was captured by the script but check the baseline `fullPage` shot for regions you
  did not name.
- **Icon-only buttons with no text and no label.** They are in the extraction (a button with
  empty text); their *identity* is not. Use the baseline image and, where still ambiguous, hover
  one for its tooltip. These become probe-list entries when their purpose cannot be established.

### 9. Draft the tree and manifest

Apply the componenthood tests from `rules/component.md` to each region (nameable in a word or
two? grouping signal? repeated?), check the registry for container-level matches, and write
`## Component tree` and `## Output manifest`. Paths and class names come from `conventions.md`.
Nesting mirrors the real UI. `[REUSE <Class>]` for recognized containers — no new file.

### 10. Validate, then stop at the checkpoint

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=inventory .pom-generator/analysis/<slug>
```

Fix what it reports, set `Meta.Phase: inventory`, and present the checkpoint per `pipeline.md`:
region map, recognition table, **the probe list with a one-line why per entry**, uncertainties,
planned files. A good probe list for a real page is five to ten entries — the search input nobody
has wrapped, the control that opens an unknown dialog, the icon button whose purpose is unclear.

**Stop and wait for the user's reply.** Do not begin probing in the same turn.
