# Rules — Element scope

**Invariants**, not a procedure. These hold in every phase. When a phase document and this file
seem to disagree, this file is describing what must be true and the phase document is describing
when to do it; both apply.

Scope: one element — a single interactive or informational leaf (`01-glossary.md`).

---

## E1. Classification requires visual and DOM agreement

Neither alone is sufficient.

- **DOM alone** misses that a `<div>` with no role is styled and behaves as a button, and that a
  `<button>` is actually a filter toggle rather than an action.
- **Visual alone** misses that a control that looks like a text box is a combobox, and that two
  identical-looking chips are one filter and one static badge.

The bulk extraction supplies the DOM half (tag, role, hook, computed `cursor`, handler signals);
the baseline screenshot supplies the visual half. When they disagree, the disagreement is the
finding — record it in `Notes:` and let a probe settle it. A quiet resolution in favour of
whichever was read last is how a wrong type gets locked in.

## E2. The probe must match the element type

A lesser action never substitutes for the required one.

| Type | Required | Not sufficient |
|---|---|---|
| Text input | typing | clicking (proves focusable only) |
| Dropdown | selecting a value | opening and closing |
| Checkbox | toggling | noting that it exists |
| Multi-select | selecting two, removing one | selecting one |
| Sortable header | two clicks | one |
| Date range | both ends | the start date |
| Split button | both halves separately | either half |

If you find yourself writing a conclusion like "it doesn't do X" on the strength of an action
lighter than the type requires, that conclusion is unearned. The required action per type is the
`**Required probe:**` line of the catalog entry, and **V011 enforces it** — the verb has to be the
one that type's behaviour is observable through, not merely a legal verb.

That distinction is the whole point. Opening a dropdown, looking at the options and pressing Escape
is honestly recorded as `Probe: Clicked`, which passes every generic check while leaving the
selection behaviour untested — along with anything a selection would have revealed. A conditional
field that appears only once a value is chosen does not exist yet at the moment you press Escape,
and "I did not see it" then gets written down as "it is not there".

## E3. Behaviour is never inferred from another element

Not from a sibling. Not from a similar label. Not from a control in the same toolbar. Not from
the same-looking button on a different row.

(Recognition against the registry is not inference from another element — it is inference from
the *codebase*, whose wrapper documents the behaviour, and it is declared as
`Status: recognized` with the class named. What this rule forbids is carrying one on-page
element's probe outcome to another silently.)

Two buttons that look alike routinely differ: one navigates, one opens a dialog, one does neither.
An analysis that carries a tested element's outcome across to an untested one *looks complete in
the summary* while being unverified, which makes it worse than an obvious gap.

The one legitimate exception is **declared** extrapolation, and the artifact has a shape for it:
give the group a `Class:`, probe one member in full, and give the others `Status: probed-by-class`
with a `Class-ref:` naming the one that did the work. V017 refuses a class where nobody was
probed; V018 refuses an inherited outcome with nothing to inherit from.

That mechanism is what makes the difference enforceable. Silent extrapolation *looks complete in
the summary* while being unverified, which makes it worse than an obvious gap — a declared class
says exactly which observation the conclusion rests on, and how many elements are leaning on it.

Membership is a claim about markup, not about looks: same type, same container, same class stem or
`data-*` prefix, same handler. Two identical-looking icon buttons in one toolbar are routinely a
navigation and a dialog opener.

## E4. "Observed" is not an outcome for anything actionable

`Observed` means "I saw this static element and it needs no interaction." It is legal only for
`Kind: static`.

Every button, input, checkbox, link, toggle, tab, icon-button and option records a real action
verb (`01-glossary.md`) and a real result. Validator rule **V011** rejects the alternative.

Classifying something as `static` to avoid probing it is the loophole this rule closes: if it has
a role, a handler, a cursor change, or a hover state, it is `actionable`.

## E5. Every element ends in a terminal state

`pending` is not an ending. Each element finishes as `probed`, `static-confirmed`, or
`blocked-<reason>` — and `blocked-` requires a stated reason and surfaces as a warning so the gap
is visible rather than absent (V010, W001).

An element you could not probe is a legitimate outcome. An element you forgot is not, and the
queue on disk is what makes the difference detectable.

## E6. Clean state between probes

Each probe starts from baseline. Probing element B while element A's dropdown is still open gets
B's click intercepted and B misclassified — and then the wrong wrapper is written for an element
nobody realised was never reached.

When a probe left state behind — an overlay open, a filter applied, a value in a form —
**navigate to the page URL again.** That is the reset, it is always available, and it is never
worth agonizing over. Undoing the specific change is fine when it is obviously sufficient.

## E7. Selector proximity

Every getter uses the **shortest path from its own component's root**, and `Scope:` is where that
root is written down. A selector is only meaningful together with the frame it resolves in: the
same cell selector matches once per row against the document and exactly once inside a row, and
the second is the number the generated wrapper will actually see.

1. The element itself carries whatever `Meta.Selector-strategy` ranked first for this app
   (`04-selectors.md`) → use it directly.
2. Its immediate parent carries one → locate the parent, then reach the child by role or position.
3. Neither → go up one more level. **No further.**

Inside a component class, every locator is relative to that class's own root. A component receives
a scoped root; it knows its internals, not where it sits in the page.

**A page-rooted selector inside a component class is a defect**, not a style preference (V040,
V041). It breaks the moment the component is moved or reused, it searches the whole document, and
it silently couples the component to one page. The check is against `Scope:`: anything scoped to
something other than `page` must not root at the page.

The root expression itself is the project's, not this document's — `this.element`, `self.element`,
`self._root`. V040 matches the shape, so a Python wrapper validates on the same terms as a
TypeScript one; `conventions.md` decides which form is correct for this repo.

Page-level elements that genuinely belong to no component carry `Scope: page` and use the page
root. That is a real distinction, not a fallback: it records that the region they sit in was never
extracted as a component.

## E8. Every selector is grounded against the page it describes

A selector is a claim, and `Resolves:` is the page's answer to it — the match count returned by
the grounding pass (`03-toolbelt.md`), recorded verbatim. `0` means the selector describes nothing
here; more than `1` means the wrapper will silently take the first of several.

Neither is a formatting problem. Both mean the string was written from somewhere other than this
page: from memory, from a similar control elsewhere in the app, or — most often — from a
`component-registry.md` entry that matched on appearance. A registry match is a hypothesis about
which class wraps this element. **It is never a source of selectors.**

`Selector:` holds the raw string, in no language. `Locator:` holds the expression that reaches the
generated file. The split is what lets one `browser_evaluate` check a Python project's selectors
and a TypeScript project's identically, and W007 keeps the two from drifting apart.

## E9. A locator you are unsure of is looked at, not trusted

`Resolves: 1` proves a selector is real and unambiguous; it says nothing about whether it points
at the control you described. For the few locators where that doubt is real — an icon in a row of
icons, a text anchor on a page full of similar text — `browser_highlight` plus a screenshot
settles it before it reaches generated code. The systematic visual pass happens in
`generate/verify.md`.

## E10. Naming comes from behaviour, not from appearance

The method name describes what the element *does*, established by the probe:

- a button labelled "Go" that applies filters → `applyFilters()`, not `clickGo()`
- a gear icon that opens column settings → `openColumnSettings()`, not `clickGearIcon()`
- a text input that filters a table live → `search(text)`, not `fillSearchBox(text)`

An icon-button's name usually comes from its tooltip, which is why hovering is part of its probe.

Casing and prefixes follow `conventions.md` — camelCase for TS/JS, snake_case for Python, plus
whatever getter/action prefixes the project already uses. The project's convention always wins
over the shapes suggested in the catalog.

## E11. Effort is proportional to what is at stake

A flat per-element cost is what turns a page into a two-hour run that never reaches code
generation. An analysis that is thorough about seven navigation links and never opens the dialog
has spent its budget on the part nobody was going to get wrong.

The invariant is not "be fast". It is:

- **Recognition first.** A control the registry fingerprints is answered by the codebase, at zero
  browser cost. Probing it re-learns what is already documented.
- **Spend the probes on what the page is for.** Dialogs, drawers, the controls that change the
  collection, anything that reveals something, anything conditional, anything unrecognized.
- **Never buy a conclusion cheaper than the evidence for it.** `Probe: Read` is for markup that
  already states the answer, which is why V019 refuses it for every family whose behaviour only
  exists at interaction time.
- **Doubt escalates, never de-escalates.** Discovering that a "link" intercepts its click, or that
  a class member has a different handler, is a reason to probe it properly — not a reason to write
  a plausible sentence.

## E12. State-dependent elements are elements

A clear (X) icon that exists only once text is typed, a validation message, a character counter, a
"no results" state, a spinner — each is a real element with its own ID, discovered during probing
and appended to the queue with `Status: pending`.

They are the most commonly missed elements in the entire process, because they are invisible in
the baseline snapshot that the inventory was built from. The probe is where they surface; the
queue is what makes sure they are then probed themselves.
