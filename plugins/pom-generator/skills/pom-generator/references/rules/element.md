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

So: write `Visual:` from the screenshot *first*, before reading the DOM, then write `DOM:`, then
reconcile. When they disagree, the disagreement is the finding — record it in `Notes:` and let the
behavioural probe settle it. A quiet resolution in favour of whichever was read last is how a
wrong type gets locked in.

`browser_evaluate` settles most of these: a computed `cursor: pointer`, an attached handler, or a
class stem containing `btn` tells you what the markup does not say.

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
`**Required probe:**` line of the catalog entry.

## E3. Behaviour is never inferred from another element

Not from a sibling. Not from a similar label. Not from a control in the same toolbar. Not from
the same-looking button on a different row.

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

After each probe: undo what changed, verify with a snapshot, and record how in `Reset:`.
**If state is ambiguous or an overlay will not dismiss, navigate to the page URL again.** That is
the correct recovery, not a workaround, and it is always available.

## E7. Selector proximity

Every getter uses the **shortest path from its own component's root**, and `Scope:` is where that
root is written down. A selector is only meaningful together with the frame it resolves in: the
same cell selector matches once per row against the document and exactly once inside a row, and
the second is the number the generated wrapper will actually see.

1. The element carries a `data-testid`/`data-aid` → use it directly.
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

The same applies to geometry. `Box:` is measured, and V072 checks the screenshot filed against it
really is that size, because a crop of the wrong node still produces a perfectly good-looking image
— and every description written from it is then wrong in a way nothing downstream can see.

## E9. Locators are cross-checked, never delegated

Author the locator from `conventions.md`'s priority order, then ask
`browser_generate_locator` for Playwright's opinion and record it in `Locator-pw`.

They serve different purposes: yours respects project convention and component scoping;
Playwright's is canonical and page-rooted. **Disagreement is information, not an error to
resolve quietly** — it usually means either your selector reaches deeper than it needs to, or the
element is genuinely ambiguous. Record it as `Locator-agree: no — <reason>` (V042) and let it
surface as a warning.

Never invent a `Locator-pw` value. If the tool is unavailable, say so in `Meta.Tools-degraded`.

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

Every element carries a `Tier:` (`02-artifact-schema.md`), and the tiers exist because a flat
per-element cost is what turns a page into a two-hour run that never reaches code generation. An
analysis that is thorough about seven navigation links and never opens the dialog has spent its
budget on the part nobody was going to get wrong.

The invariant is not "be fast". It is:

- **Spend `full` on what the page is for.** Dialogs, drawers, the controls that change the
  collection, anything that reveals something, anything conditional.
- **Never buy a conclusion cheaper than the evidence for it.** `Tier: evidence` is for markup that
  already states the answer, which is why V019 refuses it for every family whose behaviour only
  exists at interaction time.
- **A tier may be raised mid-run, never lowered.** Discovering that a link intercepts its click, or
  that a class member has a different handler, is a reason to probe it properly — not a reason to
  keep the cheap tier and write a plausible sentence.
- **A budget overrun is reported, not absorbed.** Stopping at 1.5× with honest `pending` statuses
  beats an unbounded run, because the artifact is still usable and the user still has a decision.

## E12. State-dependent elements are elements

A clear (X) icon that exists only once text is typed, a validation message, a character counter, a
"no results" state, a spinner — each is a real element with its own ID, discovered during probing
and appended to the queue with `Status: pending`.

They are the most commonly missed elements in the entire process, because they are invisible in
the baseline snapshot that the inventory was built from. The probe is where they surface; the
queue is what makes sure they are then probed themselves.
