# P4 — Classify

**Goal:** decide which class wraps each element, and what its locator is.
**Produces:** `Registry`, `Locator`, `Locator-pw`, `Locator-agree`, and `## Delta` on a re-run.
**Ends:** the analyze run. Still no code written.

By now every element has a confirmed type and a real observation. This phase turns that into
wrapping decisions.

---

## 1. Finish the tree

P3 will have revealed components that P2 could not know about — dialogs, menus, autocomplete
lists. Fold them into `## Component tree` in their correct nesting position (inside the component
that opened them, not on the page) and give each a manifest row.

Then re-read the whole tree once. Probing often changes what the right boundary is: a "panel" that
turned out to be three unrelated controls, or three regions that turned out to be one repeated
card. Adjust now, while it is still only markdown.

## 2. Match against the registry

For each element, and each component, search `component-registry.md`:

| Result | Record |
|---|---|
| Matches an entry's DOM signature | `Registry: <ClassName>` |
| Nothing matches | `Registry: NEW` |
| Close but not identical | `Registry: NEW` + a `Notes:` line naming what it resembles and how it differs |

The third case is the valuable one. It is what the registry's "Not to be confused with" field is
built from, and it is what stops the next run misclassifying the same pair.

Match on **observed behaviour plus DOM signature**, not on appearance. Two visually identical
chips where one filters and one is decorative are not the same component — P3 established that.

Warning W005 fires when something is `NEW` while another element of the same type already has a
wrapper. Check each one; it is usually right.

## 3. Author locators

Per `rules/element.md` E7, shortest path from the component's own root:

1. the element itself carries whatever `Meta.Selector-strategy` ranked first → use it
2. its immediate parent carries one → locate the parent, then reach the child by role or position
3. neither → one more level up, no further

Which hook that is comes from `Meta.Selector-strategy`, measured at survey, and from
`04-selectors.md` for what counts as stable — never from a fixed preference written into this
document. An app with no test attributes is a normal case, and structure or XPath is the correct
answer there rather than a compromise.

Inside a component, everything is relative to `this.element`. Page-level elements use `this.page`.
A `page.`-rooted locator inside a component fails validation (V040, V041) because it breaks reuse
and couples the component to one page.

Follow `conventions.md` for the attribute priority order — and take it from `conventions.md`, not
from this document. `data-aid` is one project's answer; another uses `data-testid`, `data-qa`, a
plain `id`, or a name attribute. The survey recorded which attributes this app actually carries;
that plus the project's own convention decides, and neither is assumed here.

**`Selector:` and `Locator:` are different fields and both matter.** `Selector:` is the raw string
the grounding pass checked against the page. `Locator:` is the expression that goes into the
wrapper, in the project's language, rooted per the rule above. When you write `Locator:`, it must
still select on what `Selector:` grounded — W007 fires when it does not, which is the shape of
copying a selector out of `component-registry.md` into generated code without it ever having
touched this page.

If authoring the locator makes you change the selector — a shorter path, a better attribute —
change `Selector:` too and re-ground in step 5. A locator that was never grounded is exactly the
thing this pipeline exists to prevent.

## 4. Cross-check with Playwright

For each element:

```
browser_generate_locator  → Locator-pw
```

Then compare with what you wrote:

- **agree** → `Locator-agree: yes`
- **disagree** → `Locator-agree: no — <reason>`

Disagreement is information, not a defect to smooth over. It usually means one of:

- your selector reaches deeper than necessary → shorten it
- the element is genuinely ambiguous → the wrapper needs a more specific root
- the project convention differs from Playwright's default → expected, record the reason

It surfaces as warning W002 so the user sees it. Never invent a `Locator-pw`; if the tool is
unavailable, say so in `Meta.Tools-degraded` and omit the field.

## 5. Re-ground the final selector set

Selectors changed during this phase: shortened, re-rooted, replaced with a better attribute. Run
the grounding pass from `03-toolbelt.md` once more over the final set and write back `Resolves:`
and `Box:`.

Once at the end of P1 and once here is enough — two tool calls for the whole run. What they buy is
that no selector reaches `/pom-generate` without the page having confirmed it exists and is
unambiguous (V043–V045).

`Resolves: 0` here means the locator you just authored is fiction. `Resolves:` above 1 on anything
that is not a container or a declared class means the wrapper will silently take the first match.
Fix both; do not record them and move on.

## 6. Confirm the locator visually

For each locator, before trusting it:

```
browser_highlight  <element>
browser_take_screenshot
browser_hide_highlight
```

**Read the screenshot** and confirm the highlight is on the element you meant.

This catches the one failure grounding cannot: a selector that resolves perfectly well, to exactly
one node, *which is the wrong node*. `Resolves: 1` proves a selector is real and unambiguous; it
says nothing about whether it points at the control you described. Only looking does.

## 7. Delta, on a re-analysis

If this run started from an existing artifact, write `## Delta` directly after `## Meta`:

```md
## Delta
**Against:** 2026-08-01T09:14:00Z
**Added:** E-22, E-23
**Removed:** E-09
**Changed:** E-04 (options 4 -> 6), E-11 (column added)
**Unchanged:** 18 elements
```

Compare by name and DOM signature, not by ID. Removed elements keep their IDs with
`Status: removed`; nothing is ever renumbered.

`/pom-generate` reads this to regenerate only affected files.

## 8. Validate and report

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" .pom-generator/analysis/<slug>
```

Full rule set. Fix anything reported, then set `Meta.Phase: classified`.

Report to the user:

- counts — probed / static / blocked
- components reusing registry entries vs. `NEW`
- every `blocked-*` with its reason, and what it would take to unblock
- every `Locator-agree: no`
- the planned output files
- on a re-run, the delta

Then **stop**. Say that `/pom-generate <slug>` is next; do not run it. The artifact is a
deliverable in its own right and the user may want to read it, edit it, or commit it first.
