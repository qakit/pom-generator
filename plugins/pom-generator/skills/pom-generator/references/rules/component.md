# Rules — Component scope

**Invariants** for deciding what becomes its own class. This is the highest-leverage judgement in
the whole process: a wrong boundary propagates into every file generated from it, and unlike a
wrong selector it is not caught by verification. That is why P2 has its own gate.

Scope: a container that groups elements into one named, reusable unit (`01-glossary.md`).

---

## C1. Think like someone architecting a frontend, not describing a page

A well-built React or Vue application does not flatten a `FilterPanel` into eleven loose props on
its parent. Neither should the Page Object.

The default structure is **Page → Components → elements**, mirroring the real UI. Deviate only
where `conventions.md` documents an established pattern in this specific codebase — a fluent
chaining style, a different composition approach. **Project convention always wins**; this default
only fills gaps that Explore did not cover.

## C2. The naming test

> If you can say what the container *is* in one or two words — a filter panel, a toolbar, a
> results table, a user card — it is a component.

This is a stronger signal than any markup detail. A thing with a name is a thing with a boundary.

## C3. Grouping signals are not limited to test attributes

Any of these marks a component boundary:

- a test attribute on the container, whichever this app uses (`04-selectors.md`) — the easiest case
- a `role` such as `dialog`, `table`, `tablist`, `toolbar`, `navigation`
- **a shared CSS-module class stem** — `div[class*='_filterPanel_']`, `div[class*='_checkboxes_']`.
  A generated, hashed class that still carries a readable stem across related elements is just as
  strong a signal as an explicit attribute
- consistent structural position — the same wrapper element around the same set of controls
- simply being one obvious visual unit in the screenshot

**Do not wait for a semantic attribute before extracting a component.** Waiting is what produces
the flattened page. If several siblings share a parent with any consistent identifying signal,
that parent is the boundary.

## C4. Nesting mirrors real UI nesting

A dialog's filter panel is a component **inside** the dialog component. It is not hoisted flat
onto the Page.

If the UI has a table inside a tab inside a dialog, the component tree has a table inside a tab
inside a dialog. When the tree's shape stops matching what you see on screen, the wrong thing has
been flattened.

## C5. Check the registry before creating anything

`component-registry.md` is consulted **before** any new wrapper class is proposed — and not only
for individual widgets. **Container-level entries matter most**: a filter panel or toolbar pattern
already wrapped for another page should be reused or extended, never redefined.

Three outcomes, all explicit:

| Outcome | Record |
|---|---|
| Matches an existing entry | `Registry: <ClassName>`, `[REUSE <ClassName>]` in the tree |
| Genuinely new | `Registry: NEW`, and a `// REVIEW: new pattern, not in registry` comment in the generated file |
| Close but not identical | `Registry: NEW` plus a `Notes:` line naming what it resembles and how it differs — this is what the registry's "Not to be confused with" field is built from |

Warning W005 fires when something is marked `NEW` while another element of the same type is
already wrapped, which catches the most common accidental duplication.

## C6. A component owns its root and nothing above it

A component class receives a scoped `Locator` as its root and addresses everything relative to
`this.element` (see `rules/element.md` E7). It knows its own internals; it does not know which
page it is on.

This is what makes reuse real rather than nominal. A `FilterPanel` that reaches
`page.locator('.content .sidebar .filters input')` is not reusable — it is a page-specific class
wearing a component's name.

## C7. Repetition means one class plus indexing

A card that appears twelve times is **one** component class obtained by index or key — never
twelve getters. Same for table rows, list items, tree nodes, chips.

The collection is one class; the item is another; everything else is `getItem(n)` /
`getItemBy(text)`. See `catalog/collections.md`, and check `conventions.md` Stage 0.4 for whether
this project's indexing methods return a wrapper instance or a raw `Locator` — that decision is
already made and must be followed.

**The item's own parts belong to the item, not to the page inventory.** A row showing an avatar, a
name, a date range, a status and a type is *one* `E-nn` for the row plus accessors on the row
component — not five page-level elements, and certainly not five per row. Inventorying cells
individually inflates the survey, inflates the Gate 1 budget, and produces position-indexed
locators like `row cell >> nth=3` that break the first time a column moves.

The controls *inside* a row that do something — an action button, a link, a checkbox — are real
elements and belong to the row component. They are also a textbook equivalence class: probe one
row's button in full, give the rest the same `Class:` (`02-artifact-schema.md`).

## C8. Every revealed container becomes a file

A dialog, drawer, menu panel, popover or autocomplete list that a probe brings into existence gets:

1. its own `C-nn` in the revealing element's `Reveals:`,
2. its own region so its children have somewhere to live,
3. its own entry in the component tree,
4. its own row in the output manifest,
5. its own generated file.

The parent references it through the opener method: `clickCreate()` returns `CreateEmployeeDialog`.

**An analyzed dialog without a generated component file is unfinished work.** Validator rules
V030 → V023 → V050 chase this chain from the observation all the way to a planned file, so
"the dialog has a Save and a Cancel" can no longer pass as analysis.

## C9. When to stop decomposing

Components exist to be reused and to keep locators short. Two counter-pressures:

- **Too flat**: a Page with more than about a dozen direct element getters almost certainly has an
  unextracted panel or toolbar inside it. Warning W004 flags a region holding more than 15
  elements for the same reason.
- **Too deep**: a component wrapping a single element, or one that exists only because a `<div>`
  exists, adds indirection without buying reuse or scoping. If you cannot name it (C2) and nothing
  else will ever use it, it is not a component.

A container that is a pure layout wrapper — a flex row with no name and no identity — is not a
component. Skip it and address its children from the nearest named ancestor.

## C10. Page-level elements must be declared, not defaulted

Some elements genuinely belong to no component: a page title, a top-level breadcrumb. That is
fine, but it must be a decision rather than an oversight — mark the region `Notes: page-level`
so the tree accounts for it (V052).

An element ending up on the Page because nobody decided where it went is exactly the flattening
this file exists to prevent.
