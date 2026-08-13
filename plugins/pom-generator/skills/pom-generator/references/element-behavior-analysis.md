# Element behavior analysis (interactive exploration)

This is how to actually understand a page before wrapping it — not just reading a
static snapshot, but probing elements to learn their real behavior. Static markup
often can't tell you whether an input is a plain field or an autocomplete, whether a
button submits a form or just toggles a filter, or whether a dropdown cascades into
other elements. This step exists to find that out directly.

## General architecture philosophy (applies to everything below)

Think like someone architecting a real frontend application, not just describing a
page. Every distinct visual/functional unit — a filter panel, a dialog, a tab's
content, a table row — is its own component, the same way a well-built React/Vue app
wouldn't flatten a `FilterPanel` into loose props on its parent. Concretely:

- A container with a clear semantic role (filter bar, toolbar, sidebar, card) becomes
  its own Component class, not a flat list of getters on the parent Page.
- **Grouping signals aren't limited to `data-testid`/`data-aid`/`role`.** A shared CSS
  module class fragment on a container (e.g. `div[class*='_checkboxes_']`,
  `div[class*='_panel_']`, any generated/hashed class that still shares a readable
  stem across related elements) is just as strong a signal that everything inside it
  belongs to one component — don't wait for an explicit semantic attribute before
  extracting a container into its own class. If several sibling elements share a
  parent with any consistent identifying signal (attribute, class stem, or even
  consistent structural position), treat that as the component boundary rather than
  flattening them onto the parent Page as individual getters.
- When in doubt whether a container "counts" as its own component: if you can name
  what the container *is* in one or two words (a filter panel, a toolbar, a card), it
  should be a component — that's usually a stronger signal than the specific markup
  used to find it.
- Nesting should mirror actual UI nesting: a dialog's own filter panel is a component
  inside the dialog component, not hoisted flat onto the Page.
- Default to this Page Object + Page Component structure unless `conventions.md`
  (from Explore) documents a different established pattern in this specific
  codebase — e.g. a fluent/chaining call style, or a different composition approach.
  Established project convention always wins over this default; this default only
  fills gaps Explore didn't cover.
- Check `component-registry.md` for container-level entries (not just individual
  widget entries) before generating — a filter panel or toolbar pattern already seen
  on another page should be reused/extended, not redefined from scratch.

## Traversal order

Walk the page systematically, top to bottom, left to right, the way a person visually
scans a page. This isn't just cosmetic — it keeps sibling/dependency relationships
(e.g. "this dropdown affects that section below it") discoverable in the order they'd
actually be noticed, and keeps the generated file's structure predictable.

## Per-element-type analysis

For each element encountered during the traversal, apply the relevant procedure below.
All probing actions here are non-destructive info-gathering and are allowed under
`action-safety.md` — but the caution about actual data-mutating actions (see the
dialog-actions section below) still applies fully.

### Text inputs

1. First, try to infer intent from static signals: label text, placeholder, name/id
   attributes, `aria-label` (e.g. "employees", "search query" style names).
2. Type a short, generic probe string into it.
3. Observe what happens:
   - A new dropdown/listbox/suggestion-list appears → this is an autocomplete/combobox
     pattern. Check `component-registry.md` for a matching wrapper (e.g.
     `AutocompleteInput`); if none exists, this is a strong candidate for a new
     registry entry, not just a one-off getter.
   - A network request fires and the page/results update in place, with no dropdown →
     this is a live-search/filter-as-you-type input, not an autocomplete. Wrap it
     accordingly (e.g. exposes a `search(text)` method that also describes what
     updates as a result, not just a `fill()` passthrough).
   - Nothing happens beyond the value being entered → plain text input.
4. Clear the probe value afterward — don't leave test data entered in the live page.

### Date / date-range inputs

1. Click into it and observe what appears — inline calendar, a popover/dialog date
   picker, dual start/end fields, a native date input, etc.
2. If a picker widget appears and no existing registry entry matches its structure,
   treat it as a new custom element: analyze its full internal structure (navigation
   between months, individual day cells, range-start/range-end selection, confirm/
   apply button if any) and wrap it with all the actions it actually exposes — not
   just "click a date," but whatever the real interaction surface is.
3. Register it in `component-registry.md` if new, so future date pickers on other
   pages in this project reuse the same wrapper.

### Buttons

1. Click it.
2. Watch both the network (any request fired) and the page (any visible change:
   navigation, new content, dialog opened, section toggled, data filtered).
3. Classify based on what actually happened — this determines both which wrapper
   pattern applies and, in the flow/multi-step context, what "output" it should be
   treated as (see the specific cases below: dialog, filter, tab).

**Never infer a button's behavior from a different button, even one that looks
similar or sits nearby.** A "Create X" button, an "Open X" button, and a row's own
action button can each do something completely different — one might navigate, one
might open a same-page dialog, one might do neither. If a page has a "more actions"
icon-button that was already clicked and found to navigate, that tells you nothing
about what a separately-labeled "Create" button does — click it too, independently.
Recording an untested button's outcome as if it matched a tested one is the single
most likely way this analysis silently produces wrong wrappers, because it looks
complete in the summary while actually being unverified.

### Icon / SVG / image / anchor acting as a button

Some elements are semantically buttons but not a `<button>` tag — an `<svg>` or `<a>`
with a class/id/aria-role suggesting button behavior (e.g. class contains `-btn`,
`icon-button`, `role="button"`, or it's an `<a>` with `href="#"`/`onClick` and no real
navigation target). Detect these by attribute inspection, not just tag name, and once
identified, run the exact same click-and-observe procedure as "Buttons" above. Don't
let tag type alone determine whether something is treated as a clickable action.

### Dialogs opened by a button

1. After a click opens a dialog (no URL change, new `role="dialog"` or equivalent
   container appears), treat this the same as wrapping a page: analyze the dialog's
   full internal structure — buttons, inputs, dropdowns, tabs, everything — using
   these same per-element-type rules recursively.
2. If no dialog/modal wrapper class exists yet for this shape, create one and register
   it in `component-registry.md` (see the existing `Modal` entry as a starting point —
   extend or create a more specific one if this dialog's structure warrants it).
3. To close/return: prefer whatever the dialog itself offers (an explicit close
   button, or Escape) over navigating away. If neither closes it, navigate back to the
   URL you started from and resume traversal from where you left off. Never assume the
   dialog closed just because an action inside it looked like it should close it —
   verify with a snapshot.

### Buttons that change filtering/results

If clicking a button changes the visible result set (detect via a network request
plus a before/after snapshot diff, not either alone — a request can fire without
visible change, and a visible change can happen without a request), treat this as a
filter/action control, not a navigation. Wrap it as an action method that reflects
what it actually does to the page state (e.g. `applyStatusFilter('Active')`), and note
in the wrapper what part of the page it affects, if that's discoverable.

### Dropdowns / selects

1. Select a value from it.
2. Observe whether anything else on the page changes as a result — another dropdown
   appearing/changing its options, a section showing/hiding, other fields becoming
   enabled/disabled.
3. If a dependency is found (this dropdown's selection affects other elements), this
   needs to be understood and documented as a relationship, not just wrapped as an
   isolated element — the goal is to cover the cases each selection actually produces,
   not just the default state. Apply the same recursive per-element-type analysis to
   any newly-revealed elements.
4. This is the same principle as the dialog case: something appearing as a result of
   an interaction gets fully analyzed, not just noted as "exists."

### Dialogs with Save / Cancel / Apply / Filter actions

If a dialog contains actions like Save, Apply, or Filter, it likely persists a setting
or applies a filter that changes the page's state after closing. Understanding its
**structure** (what fields it has, what each does) is the priority and is always safe
to do via the probing rules above. Actually **clicking Save/Apply** is a state-changing
action — per `action-safety.md`, do this only with explicit permission for that
specific instance; prefer Cancel/Escape to close after you've understood the
structure, unless the user has explicitly asked you to verify the save behavior too.

### Tab-like elements

1. Click it once, observe the UI switching to that tab's content.
2. Click it again (or click away and back) — note whether re-clicking an already-
   active tab does anything different (some frameworks re-fetch, some no-op).
3. Because switching tabs can change a large portion of the UI, treat each tab's
   revealed content as its own area to fully analyze with these same rules — a tab
   panel is a component (per the architecture philosophy above), and its contents
   deserve the same top-to-bottom, left-to-right walk as a fresh page would.

## Self-verification: use the framework you just generated to test itself

After generating wrapper classes for a page (or a meaningful chunk of one), don't stop
at "the code compiles." Actually exercise it:

1. Using the Playwright MCP browser session, instantiate the generated Page/Component
   classes against the real live page (conceptually — construct calls the way a test
   would, passing the MCP-driven page object into the generated class).
2. Call each generated getter/action method in turn and confirm: the locator actually
   resolves to a real element (not zero matches, not ambiguous multiple matches), and
   each action method produces the effect its name implies.
3. Anything that fails this check is a real problem with the generated selector or
   method, not a style nitpick — fix it before presenting the file, and mention in the
   summary that this verification pass ran and what (if anything) it caught.
4. This is specifically about validating that selectors and wrapper behavior are
   sound — it is not the same as writing an actual test case for the user's suite; it's
   a generation-time QA step, not a deliverable.

If the project's `conventions.md` or fixture setup makes this kind of direct
instantiation awkward (e.g. constructors require dependencies only available inside
the real test framework's fixture system), do the closest practical equivalent — at
minimum, re-snapshot after each probing action already performed above and confirm the
elements you wrapped still match what's in the snapshot, rather than skipping
verification entirely.
