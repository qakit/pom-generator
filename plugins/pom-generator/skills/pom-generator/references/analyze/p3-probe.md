# P3 — Probe

**Goal:** every element has a real, observed outcome.
**Produces:** `Probe`, `Observed`, `Shots`, `Reset`, `Reveals`, `Affects`, terminal `Status`.
**Runs unattended** — no gate. The artifact is the review surface.

This is the phase the whole tool exists for. Everything before it is preparation; everything after
it is bookkeeping.

---

## The loop

```
while any element has Status: pending:
    take the next pending element, class representatives first
    probe it according to its Tier
    write the artifact, update Meta.Spent
```

That is the entire control flow. **Recursion is not a special case.** When a probe reveals a
dialog, you append a region and some elements with `Status: pending` — and the loop, which is
still running, drains them. There is no separate dialog procedure to remember, no depth to track,
no "return to the parent inventory" step. There is one queue and it either has pending items or it
does not.

The old version of this document needed six nested sub-clauses to describe dialog handling. The
queue replaces all of them.

**Class representatives go first.** Everything that inherits from an element is blocked until that
element has a real outcome, and probing the representative first means a class that turns out not
to be a class is discovered while its members are still pending rather than after they have all
been marked done.

---

## What each tier owes

`Tier:` was assigned at survey and approved at Gate 1 (`02-artifact-schema.md`). It selects which
of the steps below apply.

| Tier | Steps | Terminal status |
|---|---|---|
| `full` | all of 1–9 | `probed` |
| `class`, representative | all of 1–9, plus confirm the other members really do share its markup and handler | `probed` |
| `class`, member | 2 and 9 only. Record `Class-ref:` and, in `Notes:`, what you checked to establish sameness | `probed-by-class` |
| `evidence` | 2, 6 and 9. No action, no screenshots, no reset | `probed`, `Probe:` starting `Read` |

A tier is a ceiling on cost, never a licence to conclude more than you observed. If an element
turns out to be doing more than its tier assumed — a "link" that intercepts the click, a class
member whose handler differs — **raise its tier and probe it properly.** Note the change at the end
of the run; the Gate 1 estimate being wrong is normal and worth saying out loud.

The reverse is not available. Lowering a tier mid-run to save time is how an unprobed element gets
a plausible-looking entry.

---

## Probing one element

### 1. Look at it

`browser_take_screenshot` scoped to the element (or its region if the element is small), saved as
`screens/E-nn-before.png`. **Read it.**

Confirm the `Visual:` and `Type:` hypotheses from P1 still hold. If the element is not what P1
thought it was, correct `Type:` now — that changes which catalog procedure applies.

### 2. Inspect it

`browser_evaluate` on the element for what the snapshot cannot say: tag, classes, `cursor`,
handlers, `data-*` attributes, the class stem it shares with its siblings.

This is what settles "is this div actually a button" (`rules/element.md` E1).

### 3. Look up the procedure

Find the `Type:` in `catalog/index.md` and read that entry. It gives you the required action, what
to observe, how to reset, and what it may reveal.

**Read the `**Not:**` line before acting.** A wrong type means a wrong probe, which means an
unearned conclusion.

Check `00-safety.md` before any action on a control whose name suggests mutation.

### 4. Take a network baseline

`browser_network_requests` — count before, compare after. "Did a request fire" is otherwise a
guess, and it is often the only observable outcome of a probe.

### 5. Do the required action

Exactly the action the catalog entry specifies. A lighter one does not substitute
(`rules/element.md` E2): typing for inputs, selecting for dropdowns, toggling for checkboxes,
two clicks for a sortable header, both ends of a date range.

### 6. Observe

`browser_take_screenshot` → `screens/E-nn-after.png`, and **read it**. Then `browser_snapshot` and
compare. Then `browser_network_requests`.

Write `Observed:` with what actually changed, concretely:

> listbox opened with 4 options (All, Active, Suspended, Archived); GET /api/employees?status=active
> fired; table went 84 → 31 rows; the count label updated

Not: "opens a dropdown". That restates the element's name and is what an unprobed element looks
like.

Three things to check that are easy to skip:

- **The element's own container.** A clear icon inside the input, a counter, a validation message,
  an icon that changed. These appear only in the acted-on state and are the most commonly missed
  elements on any page (`rules/element.md` E12).
- **The rest of the page.** Something enabled, hidden, repopulated, or re-counted elsewhere goes in
  `Affects:`.
- **The console.** `browser_console_messages` — an error here explains a probe that appeared to do
  nothing.

### 7. Record what it revealed

Anything that came into existence gets an ID and joins the queue with `Status: pending`:

- a **dialog, drawer, menu, popover, autocomplete list** → a `C-nn` in `Reveals:`, plus its own
  region so its children have somewhere to live, plus a component-tree entry, plus a manifest row
- a **new element** (clear button, validation message, revealed row action) → an `E-nn`, continuing
  the same sequence

Add the tree entry now, while you know what opened it. Validator rules V030 → V023 → V050 chase a
mentioned dialog all the way to a planned file, so a dialog noted but not modelled fails the run.

### 8. Reset

Undo what you did, per the catalog entry's `**Reset:**`. Verify with a snapshot that the page is
back to baseline. Record how in `Reset:`.

**If state is ambiguous, or an overlay will not close, or you have just finished a revealed
dialog: `browser_navigate` to the page URL.** This is the correct recovery, not a workaround. A
stale overlay from the previous probe is the most common cause of the *next* element being
misclassified — and that failure is silent, because the next element still gets a plausible-looking
entry.

### 9. Set a terminal status and write the file

`probed`, `probed-by-class`, `static-confirmed`, or `blocked-<reason>`. Then update this element's
block in `analysis.md` and bump `Meta.Spent`.

**Write after every element, not at the end.** The file is the state of the run. A crash or a
context compaction should cost one element.

Edit the one `### E-nn` block. Rewriting the whole file after every element costs more as the run
goes on, which is precisely backwards — the expensive rewrites land when the context is already
under most pressure.

---

## The budget

`Meta.Budget` holds the ceiling the user approved at Gate 1; `Meta.Spent` tracks against it.

At **1.5× budget**, stop. Do not finish "just the remaining few". Write the artifact, then report:
what is probed, what is still pending, what overran and why. The user decides whether to continue,
narrow the scope, or take the artifact as it stands — a partial artifact with honest statuses is a
usable result, and `Status: pending` on the rest is exactly the right record of where it stopped.

Overrunning is not a failure; overrunning silently is. The single worst outcome this pipeline can
produce is two hours of work that never reaches `/pom-generate`, because then the run cost
everything and delivered nothing.

---

## Things that end a probe early

| Situation | Status | Then |
|---|---|---|
| Destructive control | `blocked-safety` | Record what it appears to do. Continue |
| Login wall appeared | — | `00-safety.md` Rule 2. Stop, tell the user, wait |
| Cannot reach the element at all | `blocked-unreachable` | Note why. Continue |
| Behaves differently on repeat attempts | `blocked-flaky` | Note both outcomes. This is a real finding about their app |
| Genuinely non-interactive | `static-confirmed` | Requires `Kind: static`. If it has a role, handler, cursor change, or hover state, it is not static |

Every one of these ends with a recorded state. None of them ends with an element quietly leaving
the queue.

---

## When the queue is empty

Run the validator:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=probed .pom-generator/analysis/<slug>
```

It checks what used to be a manual audit nobody could do reliably: nothing pending, every
actionable element has a real action verb and a substantive observation, both screenshots exist on
disk, resets are recorded, and every mentioned dialog reached the tree.

Fix what it reports — by going back and probing, never by editing the artifact to satisfy the
rule. Then set `Meta.Phase: probed`.
