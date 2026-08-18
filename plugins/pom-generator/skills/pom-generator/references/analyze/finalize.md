# P3 — Finalize

**Goal:** every element has a final `Locator:`; the tree and manifest cover everything probing
revealed.
**Produces:** completed `Locator` fields, final `## Component tree`, `## Delta` on a re-run.
**Ends:** the analyze run. Still no code written.

---

## 1. Finish the tree

Probing revealed components P1 could not know about — dialogs, menus, listboxes. Confirm each is
folded into `## Component tree` in its correct nesting position (inside the component that opened
it, not on the page) with a manifest row if `NEW`.

Then re-read the whole tree once. Probing often changes what the right boundary is: a "panel" that
turned out to be three unrelated controls, or three regions that turned out to be one repeated
card. Adjust now, while it is still only markdown.

## 2. Author locators

Per `rules/element.md` E7, shortest path from the component's own root:

1. the element itself carries whatever `Meta.Selector-strategy` ranked first → use it
2. its immediate parent carries one → locate the parent, then reach the child by role or position
3. neither → one more level up, no further

Where the app's hook is **type-level** (many controls sharing one `data-aid` value), the instance
identity is the composition: component root + type hook + text or position. That is a feature of
the scoping model, not a workaround — inside a `TableRow`, `[data-aid='icon-button']` plus an
index or accessible name is exactly right.

Inside a component, everything is relative to `this.element` (`self.element`, `self._root` —
whatever `conventions.md` says). Page-level elements use the page root. A `page.`-rooted locator
inside a component fails validation (V040, V041).

**`Selector:` and `Locator:` are different fields and both matter.** `Selector:` is the raw string
the grounding pass checked; `Locator:` is the expression that goes into the wrapper. W007 fires
when the locator selects on a string the grounding never touched — the shape of copying a selector
out of `component-registry.md` into generated code without it ever meeting this page.

If authoring the locator changes the selector — a shorter path, a better attribute — change
`Selector:` too; step 3 re-grounds it.

## 3. Re-ground the final selector set, and close the coverage arithmetic

One grounding-pass call (`03-toolbelt.md`) over the final set, write back `Resolves:`.

`Resolves: 0` here means the locator you just authored is fiction. Above 1 on anything that is not
a container or a declared class means the wrapper silently takes the first match. Fix both; do not
record them and move on.

In the same `browser_evaluate`, run the **coverage script** (`03-toolbelt.md`) over every
baseline region and write `Coverage: claimed/found` on each region block (V085). Revealed
regions got theirs while their container was open (`probe.md`); if one is missing, reopen via
its `Open-path:` and take it now. `found > claimed` is a control with no element block — the
region is not done, whatever the element list looks like.

For a locator you are genuinely unsure points at the *right* node — not just *a* node —
`browser_highlight` + a screenshot settles it. That is a spot-check for the uncertain few, not a
per-element ritual; the systematic visual pass happens in `generate/verify.md` against the real
generated code.

## 4. Delta, on a re-analysis

If this run started from an existing artifact, write `## Delta` directly after `## Meta`
(`02-artifact-schema.md`). Compare by name and DOM signature, not by ID. Removed elements keep
their IDs with `Status: removed`; nothing is ever renumbered.

## 5. Validate and report

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" .pom-generator/analysis/<slug>
```

Full rule set. Fix anything reported, then set `Meta.Phase: classified`.

Report to the user:

- counts — recognized / probed / static / blocked
- components reusing registry entries vs. `NEW`
- **each revealed container with its full element list** — dialogs were discovered after the
  checkpoint, so this is the user's first chance to see them; a missed field inside a dialog is
  the most common gap and only the user can spot it from a summary
- every `blocked-*` with its reason, and what it would take to unblock
- the planned output files
- on a re-run, the delta

Then **stop**. Say that `/pom-generate <slug>` is next; do not run it. The artifact is a
deliverable in its own right and the user may want to read it, edit it, or commit it first.
