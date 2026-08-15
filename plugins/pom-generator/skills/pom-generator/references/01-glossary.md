# Glossary and conventions

Read this once at the start of any analyze or generate run. It defines the words the rest of the
skill uses precisely, and the ID scheme the artifact depends on.

---

## The three kinds of document in this skill

Knowing which kind you need is how you find the right file quickly.

| Kind | Directory | Answers | Read it when |
|---|---|---|---|
| **Procedure** | `analyze/`, `generate/` | "What do I do next?" | You are executing a phase |
| **Invariant** | `rules/` | "What must be true?" | You are deciding *how* to model something |
| **Lookup** | `catalog/` | "How do I probe a `<type>`?" | You have an element and know its type |

A procedure tells you to consult an invariant or a lookup. Invariants and lookups never tell you
what phase to run — they hold regardless of phase.

`00-safety.md`, `01-glossary.md`, `02-artifact-schema.md`, `03-toolbelt.md` are foundations: they
apply everywhere and are referenced by all three kinds.

---

## Scope vocabulary

These four words have exact meanings here. Using them loosely is how a page ends up with forty
loose getters instead of five components.

**Element** — a single interactive or informational leaf. One text input. One button. One
checkbox. An element does not contain other elements you would separately interact with.
→ Invariants: `rules/element.md`

**Component** — a container that groups elements into one named, reusable unit, and which you can
name in one or two words: a filter panel, a toolbar, a data table, a dialog, a card. A component
owns a root locator; everything inside it is addressed relative to that root. Components nest.
→ Invariants: `rules/component.md`

**Page** — everything reachable at one URL without navigating away. A page composes regions and
components. A page does *not* own leaf elements directly unless they genuinely belong to no
component.
→ Invariants: `rules/page.md`

**Flow** — an ordered sequence of pages and dialogs connected by real navigation steps. A flow is
not a thing that gets wrapped; it is a way of analyzing several pages that share state and
components.
→ Invariants: `rules/flow.md`

**Region** — a *survey-time* concept only, not a code concept. A visually distinct area of the
page identified from a screenshot before the DOM is consulted. Regions are the raw material for
deciding component boundaries in P2. A region may become a component, may become several, or may
dissolve into the page. Regions exist so that visual grouping is captured before DOM structure
biases the decision.

---

## ID scheme

IDs are assigned during survey and never renumbered — they are referenced across sections and
across runs (delta mode compares by ID and by name).

| Prefix | Means | Example |
|---|---|---|
| `R-nn` | Region | `R-02` |
| `E-nn` | Element | `E-14` |
| `C-nn` | Component discovered *during probing* (a dialog, a dropdown listbox, a popover that only exists after an interaction) | `C-03` |

Rules:

- Two digits, zero-padded, sequential in discovery order. Past 99, go to three digits; do not
  renumber existing IDs.
- Elements discovered mid-probe (a clear button that appears only after typing, a menu item inside
  a revealed dropdown) continue the same `E-nn` sequence. They are appended to `## Elements` with
  `Status: pending`, and the probe loop picks them up. They are not a separate category.
- A `C-nn` gets its own region entry too, so its children have somewhere to belong. A dialog is
  `C-03` in `Reveals:` and `R-07` in `## Regions` — the C-id names the component, the R-id groups
  its elements. Cross-reference them with `**Component:** C-03` on the region.
- Never reuse an ID within a page, even if the element it referred to was removed. In delta mode,
  a removed element keeps its ID and gets `Status: removed`.

---

## Status values

An element's `**Status:**` is the single field the validator uses to decide whether analysis is
finished. Only these values are legal:

| Status | Means | Terminal? |
|---|---|---|
| `pending` | In the inventory, not yet probed | **No** — blocks generation |
| `probed` | Actually interacted with; `Probe:` and `Observed:` are filled in | Yes |
| `probed-by-class` | Inherits the outcome of a member of the same `Class:` that was probed in full. Requires `Tier: class` and `Class-ref:` (V017, V018) | Yes |
| `static-confirmed` | Confirmed non-interactive (a label, a static badge, an icon with no handler). Requires `Kind: static` | Yes |
| `blocked-<reason>` | Could not be probed. Reason is required, e.g. `blocked-safety`, `blocked-unreachable`, `blocked-flaky` | Yes, but reported |
| `removed` | Delta mode only: existed in a previous analysis, gone now | Yes |

`pending` is the only non-terminal value. **The probe loop runs until zero elements are
`pending`.** That single sentence replaces every "don't let the list shrink from view" reminder —
the queue is on disk and either it is empty or it is not.

---

## Kind values

`**Kind:**` decides which validator rules apply to an element.

- **`actionable`** — can be clicked, typed into, selected, toggled, dragged. Requires a real
  action verb in `Probe:`, a non-empty `Observed:`, and before/after screenshots. The word
  `Observed` is **not** a legal `Probe:` value for these.
- **`static`** — genuinely non-interactive. Text, a read-only value, a decorative icon. Requires
  `Status: static-confirmed`. Classifying something as `static` to avoid probing it is the
  failure mode this field exists to make visible: if it has a role, a handler, a cursor change, or
  a hover state, it is `actionable`.
- **`container`** — groups other elements and is itself addressable (a table, a card, a panel).
  Probed only if the container itself responds to interaction (e.g. an accordion header). Its
  children are separate elements with their own IDs.

---

## Action verbs

`**Probe:**` for an `actionable` element must begin with one of these, capitalized:

`Typed` · `Clicked` · `Double-clicked` · `Selected` · `Toggled` · `Checked` · `Unchecked` ·
`Hovered` · `Pressed` · `Uploaded` · `Dragged` · `Scrolled` · `Expanded` · `Collapsed`

Followed by what was actually done: `Typed "zzprobe"`, `Selected "Active"`, `Pressed Escape`.

`Hovered` alone is sufficient only for elements whose entire behavior is a hover reveal (a
tooltip). For anything clickable, hovering is not the required action.

**`Observed` is not an action verb.** It describes a result, not a probe. The validator rejects
it (V011) because "Observed" in the probe column was the single most common way an unprobed
element passed as analyzed.

---

## Slugs

A page's slug is derived from its URL path, lowercased, non-alphanumerics collapsed to `-`,
leading/trailing `-` stripped:

- `https://app.example.com/employees` → `employees`
- `https://app.example.com/employees/1234/edit` → `employees-edit` (numeric path segments dropped)
- `https://app.example.com/` → `home`

If the slug collides with an existing analysis for a different URL, append a disambiguator taken
from the query string or a short word from the page title: `employees-archived`.

Slugs are stable — once `.pom-generator/analysis/<slug>/` exists for a URL, re-analysis reuses it
so delta mode can compare.
