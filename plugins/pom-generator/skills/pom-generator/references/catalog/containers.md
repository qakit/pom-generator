# Catalog — Containers

Things that hold other things. The family rule:

> **A container that opens is a new analysis target, not a note.** When a probe reveals a dialog,
> drawer, menu panel or popover, it gets its own region, its own element IDs, its own entry in the
> component tree, and its own generated file. "The dialog has a Save and a Cancel" is not analysis;
> it is a description of a dialog you did not analyze.

This is enforced: validator rule **V030** fails any element whose observation mentions a dialog
without a `C-nn` in `Reveals:`, and V023/V050 chase that `C-nn` through to a planned output file.

The mechanics of recursion are in `analyze/p3-probe.md` — a revealed container simply appends
`pending` elements to the queue the loop is already draining. It is not a special case.

---

## containers/dialog
**Aliases:** modal, popup window, lightbox
**Identify:** `role=dialog` or `aria-modal=true`; an overlay dimming the page; focus trapped inside; the page behind is not interactive
**Not:** `containers/popover` (non-modal, page stays usable); `containers/drawer` (anchored to an edge)
**Required probe:** analyze its full interior exactly as you would a page — every input, button, tab, and nested container, each with its own ID and its own probe
**Observe:** the title, the complete set of footer actions and which are primary/destructive, whether it is dismissible by Escape or backdrop click, whether opening it fired a request to load content
**Reset:** **reload the page URL.** Do not close the dialog and continue — close actions routinely leave stale overlays, half-applied filters, or changed DOM behind, and the next probe then classifies the wrong element. Reloading is the correct recovery, not a fallback
**Reveals:** everything inside it. A dialog containing a filter panel means that panel is a component *inside* the dialog component, not hoisted onto the page
**Wrapper shape:** its own class. The parent references it through the opener: `clickCreate()` returns `CreateEmployeeDialog`. Methods: `isOpen()`, `close()`, `cancel()`, plus getters for its contents

**On Save / Apply / Submit buttons inside a dialog:** understanding the structure is the goal and
is always safe. Record that the button exists and what it appears to do. **Clicking it is a
mutating action** requiring explicit permission (`00-safety.md`). Close with Cancel or Escape.

**Skip re-analysis only** when you have already fully analyzed a dialog with the same structure
earlier in this same run — for example the same edit dialog opened from a different row. Note the
reuse explicitly rather than silently omitting it.

## containers/drawer
**Aliases:** side panel, slide-out, off-canvas, sheet
**Identify:** slides in from an edge and overlays content; may or may not be modal
**Not:** `containers/panel` (always present, part of the layout)
**Required probe:** as `containers/dialog`
**Observe:** which edge, whether the page behind stays interactive, whether it is resizable, whether its content loads on open
**Reset:** reload the page URL
**Wrapper shape:** its own class, referenced through its opener

## containers/panel
**Aliases:** filter bar, toolbar, sidebar, section, form group
**Identify:** a persistent grouped area that is part of the page layout; visually delimited by a border, background, or spacing; you can name what it *is* in one or two words
**Not:** `containers/drawer` / `containers/dialog` (they appear on demand)
**Required probe:** the panel itself is usually `Kind: container` and not probed directly. Its children are probed individually. Probe the panel itself only if it responds to interaction — collapses, resizes, or scrolls independently
**Observe:** what identifies it in the DOM. A shared CSS-module class stem (`div[class*='_filterPanel_']`) counts as a grouping signal just as much as a `data-testid` — see `rules/component.md`
**Reveals:** nothing by itself
**Wrapper shape:** its own component class. This is the single most valuable extraction: a filter panel flattened into eleven loose getters on the Page is the failure `rules/component.md` exists to prevent

## containers/card
**Aliases:** tile, item card, summary box
**Identify:** a repeated self-contained unit with internal structure — title, body, its own actions
**Not:** `collections/grid` (the container holding the cards); `containers/panel` (not repeated)
**Required probe:** probe one instance thoroughly. Confirm the others share its structure by comparing snapshots, and say that you did
**Observe:** which parts are interactive, whether the whole card is clickable as well as its inner buttons, what varies between instances
**Reset:** per whatever the probed action did
**Wrapper shape:** one class for the card, obtained by index or by key from the collection: `getCard(name)` returns a `CardComponent`. Never write one getter per card instance

## containers/accordion
**Aliases:** collapsible, expander, disclosure
**Identify:** a clickable header with a chevron, revealing a body; `aria-expanded`
**Not:** `containers/tabs` (siblings replace each other); `actions/button`
**Required probe:** expand it, analyze the revealed body's contents as new elements, then collapse it
**Observe:** whether several can be open at once or opening one closes another, whether the body loads lazily on first expand
**Reset:** return it to its original expanded/collapsed state
**Reveals:** the body's contents — real elements with real IDs, not "contains a form"
**Wrapper shape:** `expand()`, `collapse()`, `isExpanded()`, plus getters for the body

## containers/tabs
**Aliases:** tab strip, tab bar
**Identify:** `role=tablist` with `role=tab` children and a `role=tabpanel`; one active tab; switching replaces a content area
**Not:** `selection/segmented` (switches a view mode, not a panel of distinct content)
**Required probe:** click each tab and analyze its panel's contents. Then click the already-active tab once — some frameworks refetch, some no-op, and a test may depend on which. **Then return to the originally-active tab**
**Observe:** the panel contents per tab, lazy loading, whether the URL changes with the tab, disabled tabs
**Reset:** re-activate the originally-active tab and verify. Tab state persists across probes; leaving the wrong tab active changes what every later element in the parent inventory looks like
**Reveals:** each panel's contents. A panel is a component — its contents deserve the same full top-to-bottom walk as a fresh page
**Wrapper shape:** `selectTab(label)`, `getActiveTab()`, `getTabs()`; each panel is typically its own component class

## containers/tooltip
**Aliases:** hint, title popup
**Identify:** appears on hover, disappears on mouse-out, carries text only, not interactive
**Not:** `containers/popover` (click-triggered and interactive)
**Required probe:** `browser_hover` the trigger and capture the text. Hovering *is* the required action for this type
**Observe:** the exact text — often the only accessible name an icon-button has, which makes it the basis for that button's method name
**Reset:** move away and confirm it disappeared
**Wrapper shape:** rarely its own class. Usually a `getTooltipText()` on the element that triggers it

## containers/toast
**Aliases:** snackbar, notification, flash message
**Identify:** transient message, usually a corner, often auto-dismissing
**Not:** an inline validation message (belongs to its field)
**Required probe:** you do not probe a toast directly — it appears as a *result* of another probe. Record it as revealed by that element, and capture its text and severity before it disappears. Screenshot promptly
**Observe:** text, severity, auto-dismiss timing, whether it has an action link or a close button
**Reset:** dismiss it or let it expire; confirm it is gone before the next probe, since it may overlay other controls
**Wrapper shape:** usually one shared component reused across the whole app — check `component-registry.md` first, this is a classic already-wrapped pattern

## containers/popover
**Aliases:** flyout, dropdown panel, non-modal overlay
**Identify:** click-triggered floating panel with interactive contents; the page behind stays usable; no backdrop
**Not:** `containers/tooltip` (hover, text only); `containers/dialog` (modal); `actions/menu` (a list of commands)
**Required probe:** open it, analyze its contents fully, close it
**Observe:** what it contains, how it closes (outside click, Escape, a button), whether it repositions near the viewport edge
**Reset:** Escape and confirm closed; reload if it will not dismiss
**Reveals:** its contents, as a `C-nn` component
**Wrapper shape:** its own class, referenced through its trigger
