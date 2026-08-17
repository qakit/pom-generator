# Catalog — Actions

Controls that *do* something rather than hold a value. Two family rules, both learned the hard way:

> **Never infer one action's behaviour from another.** A "Create X" button, an "Open X" button, and
> a row's own action button can each do something completely different — one navigates, one opens a
> same-page dialog, one does neither. Having clicked the kebab menu and found it navigates tells
> you nothing about the Create button. Recording an untested control's outcome as if it matched a
> tested one is the single most likely way this analysis produces a wrong wrapper, because the
> summary looks complete while the entry is unverified.

> **Never trust the label or the icon to predict behaviour.** A chevron that "obviously" expands a
> section may open a dialog. A gear icon may navigate to a new page. An `<a href="#">` may be a
> filter. The only way to classify an action is to click it and observe. If you wrote
> "expands/collapses" without clicking and confirming no dialog appeared, that classification is a
> guess.

Before clicking anything in this family, check it against the "never without permission" list in
`00-safety.md`. Delete, Submit, Send, Pay, Confirm, Approve and friends are not probed — they are
recorded as `Status: blocked-safety` unless the user grants permission for that specific control.

---

## actions/button
**Aliases:** action button, CTA
**Identify:** `button`, or `role=button`, with a visible text label
**Not:** `actions/link` (has a real href and navigates); `selection/toggle`; `actions/split-button` (has a separate dropdown arrow)
**Required probe:** click it, with `browser_network_requests` counted before and after
**Observe:** classify by what *actually happened*, choosing exactly one:
  - navigated (URL changed) → the destination is its own page analysis
  - opened an overlay → `containers/dialog` or `containers/drawer`, revealed as a `C-nn`
  - changed data on the page (rows filtered, section toggled, sort applied) → note precisely what changed and by how much
  - fired a request with no visible change → say so; this is a real and easily-missed outcome
  - nothing observable → say that too, and check the console for an error
**Reset:** if it changed page state, undo it — click again to toggle off, clear the filter, or reload the page URL. An active filter left over from a previous probe changes what every later probe sees
**Reveals:** whatever appeared
**Wrapper shape:** name the method for the observed effect, not the label. A button labelled "Go" that applies filters is `applyFilters()`. If it navigates, follow the project's convention in `conventions.md` for whether it returns the next Page Object

## actions/icon-button
**Aliases:** icon-only control, kebab, gear, chevron button
**Identify:** an `svg`, `i`, or image acting as a control, with no visible text label. Detect by **attribute, not tag**: `role=button`, an `aria-label`, a class containing `btn`/`icon-button`, an `onClick`, or `cursor: pointer` from `browser_evaluate`. An `<a href="#">` with no real target belongs here too
**Not:** `other/image` (decorative, no handler)
**Required probe:** hover first to reveal any tooltip — that is often the only place its name exists — then click
**Observe:** as `actions/button`. Record the tooltip text, because it is what the getter should be named after and often the only accessible name available
**Reset:** as `actions/button`
**Wrapper shape:** named from the tooltip or the observed effect: `openColumnSettings()`, not `clickGearIcon()`

**These are the elements most often missed in inventory.** They have no text, so a text-based scan of
the snapshot skips them. The P1 second sweep exists specifically to catch them.

## actions/link
**Aliases:** anchor, nav link
**Identify:** `a` with a real `href` that changes the URL
**Not:** `actions/icon-button` (an `<a href="#">` that does not navigate)
**Required probe:** `Tier: evidence` is the default here and usually sufficient — read `href`, `target`, and whether a click handler is bound (`browser_evaluate`), and record that. A plain anchor with a real `href` and no interception does not need a page load to prove that links navigate, and a nav bar of them does not need seven. Click it only when the evidence is ambiguous: no `href`, `href="#"`, a bound handler, `target=_blank`, or a label suggesting it does something other than navigate — then it is `Tier: full`, confirm the URL actually changed, and handle a new tab per `03-toolbelt.md`
**Observe:** target URL, same tab or new tab, whether it is a full navigation or a client-side route change
**Reset:** `browser_navigate_back`, or navigate to the page URL
**Reveals:** the destination page — a separate analysis with its own slug, not part of this artifact
**Wrapper shape:** follow `conventions.md` on navigation methods — either returns the next Page Object or returns nothing

## actions/menu
**Aliases:** context menu, overflow menu, actions dropdown, kebab menu
**Identify:** opens a floating list of **commands** — verbs like Edit, Duplicate, Delete. Nothing stays selected afterwards
**Not:** `selection/single-select` (values, and one stays selected)
**Required probe:** open it, and **record every item with its enabled/disabled state**. Then click one *safe* item. Do not click Delete or any other destructive entry — record those as present and `blocked-safety`
**Observe:** the full item list, separators and grouping, which items are disabled and why, whether items open dialogs
**Reset:** press Escape and confirm the menu closed
**Reveals:** the menu panel is its own component (`C-nn`); any dialog an item opens is another
**Wrapper shape:** `open()`, `selectItem(label)`, `getItems()`, `isItemEnabled(label)`

## actions/split-button
**Aliases:** dropdown button, primary-with-alternates
**Identify:** one control with two hit areas — a labelled primary action and a separate arrow that opens alternates
**Not:** `actions/button`; `actions/menu`
**Required probe:** **probe both halves separately.** They are two elements with two IDs. The arrow opens the list; the primary runs the default action. Treating them as one element is the classic mistake with this type
**Observe:** the default action, the alternates list, whether choosing an alternate changes the default for next time
**Reset:** Escape to close the list; undo the primary action if it changed state
**Reveals:** the alternates list as a `C-nn`
**Wrapper shape:** `clickPrimary()`, `openAlternates()`, `selectAlternate(label)`
