# Generate — verify

Generated code that compiles has proven nothing about whether its selectors find anything. This
step exercises them against the real page.

It is a generation-time QA step, not a deliverable: you are not writing tests for the user's suite,
you are checking that what you just wrote works.

---

## Setup

Navigate to `Meta.URL` at `Meta.Viewport`. The page must be in the same baseline state the analysis
described — if `Meta.Notes` recorded a particular state (a filter applied, a record loaded),
reproduce it or note that you could not.

## For every getter

```
browser_highlight        <the locator>
browser_take_screenshot
browser_hide_highlight
```

**Read the screenshot.** Three outcomes, and only one is a pass:

| Result | Meaning | Do |
|---|---|---|
| Highlight on the intended element | pass | continue |
| Highlight on a *different* element | **the important failure** | fix the locator |
| Nothing highlighted / error | zero matches | fix the locator |
| Several elements highlighted | ambiguous | narrow it, or scope it to the right component root |

The second row is why this uses `highlight` rather than a presence check. A selector that resolves
perfectly well to the wrong element passes every check except looking at it.

Where `browser_verify_element_visible` / `browser_verify_value` / `browser_verify_list_visible`
exist, use them as a second signal — but they answer "is something there", not "is it the right
thing". If highlighting is unavailable (`Meta.Tools-degraded`), fall back to re-snapshotting and
confirming by ref, and say in the summary that visual confirmation was not possible.

## Specific things to confirm

**State-dependent elements.** For every input whose `Observed:` mentioned a clear button, a
counter, or a validation message: re-create that state (type into it) and confirm the generated
getter for that element resolves. These exist only in the acted-on state, so a baseline pass will
report them as missing when they are in fact fine — check them properly rather than deleting them.

**Revealed components.** For every `Reveals: C-nn`, call the opener, confirm the component appears,
and confirm at least one getter inside it resolves. Then reset per `rules/element.md` E6.

**Collections.** Confirm `getItemCount()` matches what the artifact observed, and that
`getItem(0)` and `getItemBy(<a real value>)` both resolve. Index-based and key-based lookup fail
differently and both are used.

**Selector rooting.** Statically re-check every component: every getter starts from
`this.element`, none contains a page-level reach. The validator enforces this on the artifact
(V040, V041); confirm the emitted code kept it, because a locator can be transcribed wrong.

**Action methods.** Do not re-run destructive or mutating actions to verify them
(`00-safety.md`). Confirm the control resolves and that the method name matches the recorded
`Observed:`. Safe, idempotent actions may be exercised once.

## When something fails

A failure here is a real defect in the generated code, not a nitpick.

1. Fix the locator or the method, in the file.
2. Re-verify it.
3. If the artifact's `Locator:` was wrong, correct that too — otherwise the next regeneration
   reintroduces the same bug.
4. If the artifact was wrong about the *element* rather than the selector — it is a different type
   than recorded, it does not do what `Observed:` says — that is an analysis defect. Say so plainly
   and recommend re-running `/pom-analyze` for that element. Do not paper over it in the wrapper.

Record what was caught. "Verification ran and found nothing" and "verification was skipped" look
identical in a summary unless you say which happened.

## When direct instantiation is awkward

If `conventions.md` shows Page Objects that can only be constructed inside the project's fixture
system, do the closest practical equivalent: verify the raw locators from the generated file
against the live page via the MCP session, rather than skipping verification.

The check that matters is *does this selector find the right element* — which does not require the
class to be instantiable.

## Finish

Set verified manifest rows to `verified`. Report what was checked, what failed, what was fixed, and
anything that could not be verified and why.
