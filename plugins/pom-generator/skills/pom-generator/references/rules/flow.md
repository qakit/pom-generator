# Rules — Flow scope

**Invariants** for analyzing several connected pages in one run. Scope: an ordered sequence of
pages and dialogs joined by real navigation (`01-glossary.md`).

A flow is not a thing that gets wrapped. There is no `FlowObject`. A flow is a way of *reaching*
pages that are hard to reach directly, and of noticing what they share.

---

## F1. Per-page work is identical

Every page and dialog in a flow gets the full inventory → probe → finalize treatment with its own
artifact and slug — the same recognition pass, the same probe queue, the same validator. Nothing
about being step 3 of a flow reduces the analysis.

If a flow ever produces a thinner artifact than analyzing that page directly would have, something
has been skipped.

## F2. A flow exists to reach pages, not to shortcut them

The reason to use a flow is that step 4's page cannot be visited by URL — it needs a record
created, a wizard advanced, a modal opened from a specific row. If every page in a route file is
directly reachable by URL, run them as separate analyses instead; it is simpler and each is
independently re-runnable.

## F3. Every transition is verified before continuing

After each step, confirm what actually happened matches what the route file declared (`expect`):

| `expect` | Verified by |
|---|---|
| `new_page` | URL changed, and the new page rendered |
| `modal` | URL unchanged, an overlay appeared |
| `same_page` | URL unchanged, no overlay, content mutated |

**A mismatch stops the run and asks the user.** Do not guess, and do not carry on assuming the
route file was right — an unnoticed wrong turn at step 2 produces four confidently wrong files.

## F4. Shared components are wrapped once

A navigation bar on all four pages of a flow is **one** component, wrapped once and referenced by
each page.

After each page's inventory, compare its component tree against every page already analyzed in
this flow. Matching root selector plus matching internal structure means the same component:
record `[REUSE <Class>]` and point at the existing file rather than generating a second one.

Genuinely similar but not identical components — a header with an extra button on one page — are
**not** the same component. Note the difference explicitly and let the user decide whether to
parameterise the shared one or keep two. Silently merging them produces a wrapper that is wrong on
one of the pages.

This is the main thing a flow gives you that separate per-page runs do not.

## F5. State carries forward, and that is recorded

Step 3 sees a page in the state steps 1 and 2 put it in. That is the point of a flow and also its
main hazard.

Record in each page's `Meta.Notes` what state it was reached in — which record, which filters,
which prior selections. A page analyzed only in a mid-flow state may be missing elements that
exist in its default state, and that limitation belongs in the artifact rather than in nobody's
memory.

## F6. Reset means re-running the flow, not going back

Within a page, reset is a reload (`rules/element.md` E6). **Within a flow, a page's URL is not
enough to restore it** — reloading step 3 may land on a login page, an empty form, or a 404.

Recovery is to re-run the flow from the start. `browser_navigate_back` is fine for a single step
backwards when you have just moved forward and nothing has changed; it is not a general recovery.
Because re-running is expensive, finish a page completely before advancing.

## F7. A checkpoint after every step

The user confirms each step's result before the next begins. A wrong navigation caught at step 2
costs one correction; the same error found at the end has cascaded into every file after it.

This is the one place where flows are *more* gated than single-page analysis, and deliberately so.

## F8. Destructive steps need permission, per step

A route file that says `click "Delete"` is a request, not an authorisation. Every mutating step
needs explicit per-instance permission at the moment it is reached (`00-safety.md` Rule 3),
regardless of what the route file contains.

The route file is authored by a human, but it is still input — it does not carry consent forward
into the run.

## F9. The flow file records the route, not the elements

`flows/<id>/flow.md` holds the steps, the transitions observed, the shared-component decisions,
and links to each page's own artifact directory. **Element data lives in the per-page
`analysis.md` files and is never duplicated into the flow file.**

Duplicating it is how the two copies start disagreeing — which is the failure this entire
restructure was built to remove.
