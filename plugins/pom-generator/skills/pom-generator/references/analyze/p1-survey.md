# P1 — Survey

**Goal:** every element on the page is in the artifact, with `Status: pending`.
**Produces:** `## Regions`, `## Elements`.
**Ends at:** Gate 1.

Nothing is probed in this phase and nothing is decided about components. This phase answers one
question — *what is here?* — and it is the only phase where a miss is unrecoverable, because
everything downstream only ever works from this list.

---

## Why visual comes first

The order matters and it is the inversion from how this used to work.

The accessibility snapshot is a tree. It tells you nesting and roles, and it tells you nothing
about **what looks like it belongs together**. Five controls that are visually one filter panel may
sit under three unrelated DOM ancestors; a `<div>` wrapper with no semantics may be the most
obvious visual unit on the page.

So: look at the picture first, partition it, and only then reconcile with the DOM. Reading the
snapshot first anchors you to DOM structure and you will not see the panel.

---

## Steps

### 1. Baseline screenshot

```
browser_take_screenshot  fullPage: true  filename: screens/baseline.png
```

**Read it as an image.** A screenshot saved and never looked at contributes nothing to this phase.

Record it in `Meta.Baseline`.

### 2. Partition into regions, from the image

Working top to bottom, left to right (`rules/page.md` P6), split the page into visually distinct
areas. A region is anything a person would point at and name: the header, the filter bar, the
results table, the side panel, the footer.

Do not use the DOM for this yet. You are answering "how is this page laid out?", and the
answer comes from the picture.

Typical count is 3–8. One region for the whole page means the partition has not happened; twenty
means you are enumerating elements, not areas.

### 3. Snapshot, and reconcile

```
browser_snapshot          (add boxes if supported — geometry is what maps image areas to nodes)
```

For each visual region, find its container node and record a `Root:` selector. Prefer, in order: a
`data-testid`/`data-aid`, a semantic `role`, a stable CSS-module class stem
(`div[class*='_filterPanel_']` — see `rules/component.md` C3), a structural path.

If a visual region has no single container node, say so in `Notes:` — that is a real finding, and
it is what the decomposition phase needs to know.

### 4. Region screenshots

For each region: `browser_take_screenshot` with `target` set to the region root, saved as
`screens/R-nn.png`. **Read each one.** This is where individual controls become legible — a
full-page shot at 1440px wide will not show you that an input has an inline icon.

Record in `Shot:`.

### 5. Enumerate elements

For each region, list every element: every input, button, icon-button, dropdown, checkbox, tab,
link, and every container that groups them. One `### E-nn` block per element, with `Region`,
`Visual`, `Snapshot-ref`, `DOM`, `Kind`, `Type`, `Status: pending`.

Write `Visual:` from the region screenshot **before** reading the DOM for that element
(`rules/element.md` E1). Shape, colour, iconography, position — what a person sees. Then `DOM:`.
Then pick a `Type:` from `catalog/index.md` as a *hypothesis*; P3 will confirm or correct it.

Update each region's `Contains:` as you go — membership is checked both ways (V025).

Do not enumerate the cells of a repeating row as page elements. One row is a component and its
cells are that component's accessors — see `rules/component.md` C7. Twenty rows × six cells is not
an inventory of 120 elements.

### 5a. Assign a tier, and find the equivalence classes

Every `Kind: actionable` element gets a `Tier:` now (`02-artifact-schema.md`), because the Gate 1
estimate is computed from it. This is the step that decides whether P3 takes twenty minutes or two
hours, and it is the only point at which that is still cheap to change.

- **`evidence`** — the markup already answers the question. A link with a real `href` needs its
  href read, not seven page loads to re-establish that links navigate. V019 keeps this narrow: it
  is refused outright for inputs, selections, temporal and collection types, and for anything that
  reveals something.
- **`class`** — the element is one of several that share a type, a container, a class stem or
  `data-*` prefix, and a handler. Give them all the same `Class:` id. One will be probed in full
  and the rest will inherit from it.
- **`full`** — everything else. In particular: anything that opens a dialog, drawer or menu;
  anything whose value changes what else is on screen; anything the page exists to do. **When
  unsure, `full`.** The tier system is for spending the budget where it matters, not for spending
  less of it.

Two identical-looking buttons in the same toolbar are not a class. Sameness means shared markup
and a shared handler, not a shared shape.

Budget arithmetic: `full` ≈ 10 tool calls, a class ≈ 10 for its representative plus 1 each after,
`evidence` ≈ 0.

### 6. The second sweep — this is not optional

Everything above finds the obvious elements. This step finds the ones that get missed, and the
list is drawn from what has actually been missed before:

- **Icon-only buttons with no text.** Gear, kebab, chevron, pencil, X, filter, download,
  fullscreen. They carry no text, so any text-oriented pass skips them. Hover to get the tooltip.
- **Controls inside a container you already listed.** A region being in the inventory does not put
  its children there. Every actionable thing inside it needs its own `E-nn` line.
- **Anything outside the main content column** — headers, footers, side panels, floating action
  buttons, sticky toolbars, breadcrumbs.
- **Hover-revealed controls.** Row action buttons that only appear on hover are invisible in a
  static screenshot. `browser_hover` over one row of any collection and re-snapshot.
- **Disabled controls.** They are real elements with real getters and they are easy to skim past.
- **Empty and loading states**, if visible.
- **Scrolled-out content.** If `fullPage` and the viewport differ, check what is below the fold.

Two cross-checks, both cheap:

```
browser_find  text: "..."       — sweep for control-ish words; anything found that is not
                                  already in the inventory is a miss
browser_press_key  Tab          — walk focus through the page; every stop is an interactive
                                  element and should already have an ID
```

The Tab walk is the strongest completeness check available, because the browser's own focus order
enumerates exactly the set of things that are interactive.

### 7. Register the queue

If a todo tool is available, register **one task per element**. Not one task called "analyze
elements" — one per element, marked complete only when a real observed outcome exists.

The artifact is the durable queue; the todo list is the working view of it. Both, not either.

### 8. Validate

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=survey .pom-generator/analysis/<slug>
```

Fix anything it reports. Then set `Meta.Phase: survey`.

---

## Gate 1

Present:

1. the region map — each region, its name, its element count
2. the full element inventory as a table: ID, name, region, hypothesised type, **tier**
3. the counts, and anything you were unsure about
4. on a re-analysis, the `## Delta` instead of the full list
5. **the budget** (below)

Then ask for two things, plainly:

- **Is anything missing?** Much easier for someone who knows the app than for anyone reading a
  snapshot, and a miss here is the one error nothing downstream recovers from.
- **Is this the right thing to spend the time on?** They know which controls matter.

### The budget

P3 is long, mechanical and unattended, which is exactly why its cost has to be agreed before it
starts rather than discovered part-way through. Present it as a table — elements by tier, the call
estimate, and a wall-clock estimate — followed by what you propose **not** to do:

```
  12 full      ~120 calls    dialogs, the type select, the row action, the date range
   9 class     ~30 calls     4 classes: status checkboxes, filter chips, row arrows, option rows
   8 evidence  ~8 calls      nav links and anchors — href read, not clicked
  16 static    ~0 calls      labels, headings, status text

  ~158 tool calls, roughly 25-35 minutes

  Proposed to skip: E-31..E-34 (footer links, low value for this page's tests)
```

Write the approved number into `Meta.Budget`. It is not advisory: P3 tracks `Meta.Spent` against
it and stops at 1.5×.

**Stop and wait.** Do not begin P2 in the same turn.
