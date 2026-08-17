# P2 — Probe

**Goal:** every element still `pending` gets a real, observed outcome.
**Produces:** `Probe`, `Observed`, `Reveals`, `Affects`, `Open-path`, terminal `Status`.
**Runs unattended** — the checkpoint already happened. The artifact is the review surface.

The probe list is short by construction — recognition already answered everything the registry
knows. What is left is the genuinely unknown: is this input an autocomplete, which dropdown
implementation is this, what does that gear icon open. Spend the calls here, on these.

---

## The loop

```
while any element has Status: pending:
    take the next pending element, class representatives first
    probe it (below)
    update its block in the artifact
```

**Recursion is not a special case.** When a probe reveals a dialog, you append a region and some
elements with `Status: pending` — and the loop, which is still running, drains them. There is one
queue and it either has pending items or it does not.

**Recognize before you probe, even mid-loop.** A dialog revealed by a click is decomposed exactly
like the page was: extract its elements (the diff script gives you them), match them against the
registry fingerprints first, and only the unknowns join the probe queue as `pending`. A revealed
form whose select, date picker and buttons are all recognized costs zero further probes.

**Class representatives go first** — a class that turns out not to be a class is discovered while
its members are still pending.

---

## Probing one element

### 1. Take the before-signature

Run the scoped-diff script from `03-toolbelt.md` once. It captures two things:

- a structural signature of the element's `Scope:` subtree
- **the portal layer** — the tail of `document.body`'s children, plus anything with
  `role=dialog|alertdialog|listbox|menu` anywhere in the document

The portal layer is not optional. Component frameworks (React Aria, Radix, MUI…) render dialogs,
menus, comboboxes' listboxes and date-picker calendars **at the document root, outside the
trigger's subtree**. A diff bounded to the trigger's scope alone concludes that a select which
plainly opened a listbox did nothing — the listbox is in the portal layer, not the scope.

### 2. Do the required action

Look up the `Type:` in `catalog/index.md` and read that entry — the required action, what to
observe, what it may reveal. **Read the `**Not:**` line before acting.** A lighter action never
substitutes (`rules/element.md` E2): typing for inputs, selecting for dropdowns, toggling for
checkboxes, two clicks for a sortable header, both ends of a date range.

Check `00-safety.md` before any action on a control whose name suggests mutation.

**If the action is typing, derive the value — do not invent one** (`05-probe-values.md`):

- A **query** input — search, filter, autocomplete — takes its value from **data already visible
  on the page**. A synthetic token searches for something that by construction does not exist, so
  the probe sees the empty state and learns nothing about the populated one.
- An **entry** input — a field that would be saved — stays synthetic per `00-safety.md` Rule 5,
  but **well-formed**: honour `type`, `pattern` and length.
- Match the **script of the field's own label** — Latin text in a field labelled in Cyrillic can
  trip a validator you then misattribute to the field.

Record which applied in `Value-source:` (V049). If a matching control comes back empty, retry with
a page-derived value; if still empty, say so concretely — that is a real finding.

After typing into anything that might be an autocomplete, **wait briefly** (`browser_wait_for`
with a short text/appearance condition, not a blind sleep) before diffing — suggestion lists are
debounced.

### 3. Diff

Run the same script again and subtract:

- new nodes **inside the scope** → the observation, and any new elements join the queue
- new nodes **in the portal layer** → a revealed container: dialog, listbox, menu, calendar
- changes **elsewhere** (row counts, labels, enabled states) → `Affects:`

Anything that came into existence gets an ID and joins the queue as `pending` — after the
registry check. Conditional fields are the case this exists for: a form where choosing a type
reveals a date field, a link that swaps itself for a textarea, a clear icon that appears once text
is typed. None of these exist in the baseline DOM; the diff is what makes noticing them mechanical
instead of something to remember.

If the diff is empty, check `browser_network_requests` and `browser_console_messages` — a fired
request explains a control whose effect is server-side; a console error explains a probe that
appeared to do nothing.

Write `Observed:` with what actually changed, concretely:

> listbox opened as a portal at body (4 options: All, Active, Suspended, Archived); GET
> /api/employees?status=active fired; table went 84 → 31 rows

Not "opens a dropdown" — that restates the element's name and is what an unprobed element looks
like.

**Screenshots are on-demand here, not routine.** Take one only when the DOM diff leaves a real
ambiguity a picture would settle — an unlabeled icon, a canvas widget, a layout you cannot
interpret from structure. When something *was* revealed and you do crop it, scope the shot to the
revealed container's own box, not the trigger's.

### 4. Record what it revealed

A revealed **container** (dialog, drawer, menu, listbox, popover) gets:

- a `C-nn` in this element's `Reveals:`
- its own `R-nn` region with `Component: C-nn` and — required — **`Open-path:`** stating how to
  bring it back (`click E-07`, `type into E-04, then`). V081 enforces this: a dialog nobody knows
  how to open cannot be verified, regenerated, or resumed into.
- a component-tree entry (in its real nesting position) and, if `NEW`, a manifest row.
  V030 → V023 → V050 chase a mentioned dialog all the way to a planned file.

Classify it from the DOM (`role`, `aria-modal`, position, backdrop), against
`catalog/containers.md` — not from silhouette. It opened in response to an action, so it is not
`containers/panel`; that type is reserved for what was already in the baseline DOM.

A revealed **element** (clear button, validation message, conditional field) gets an `E-nn`
continuing the same sequence, with its own `Open-path:`.

Inside a revealed dialog, remember the user's own flow: select a value in each unknown dropdown
**because fields may be dependent** — the diff after the selection is what finds the field that
only exists for the third option.

### 5. Set a terminal status, reset if needed, write the file

`probed`, `probed-by-class`, or `blocked-<reason>`. Update the one `### E-nn` block and move on.

Reset costs a call, so spend it only when state actually leaked: an overlay is open, a filter is
applied, a value is sitting in a form. **`browser_navigate` to the page URL is the reset** — undo
choreography per element is not required. After finishing a revealed dialog's queue, renavigate.
A stale overlay from the previous probe is the most common cause of the *next* element being
misclassified, and that failure is silent.

**Write after every element.** The file is the state of the run; a crash or context compaction
should cost one element. Edit the one block — do not rewrite the whole file each time.

---

## Things that end a probe early

| Situation | Status | Then |
|---|---|---|
| Destructive control | `blocked-safety` | Record what it appears to do. Continue |
| Login wall appeared | — | `00-safety.md` Rule 2. Stop, tell the user, wait |
| Cannot reach the element at all | `blocked-unreachable` | Note why. Continue |
| Behaves differently on repeat attempts | `blocked-flaky` | Note both outcomes. A real finding about their app |
| Turns out genuinely non-interactive | `static-confirmed` | Requires `Kind: static`. If it has a role, handler, cursor change, or hover state, it is not static |
| Turns out to match a registry entry after all | `recognized` | Record the class; note why inventory missed it |

Every one of these ends with a recorded state. None of them ends with an element quietly leaving
the queue.

---

## When the queue is empty

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=probed .pom-generator/analysis/<slug>
```

It checks what used to be a manual audit: nothing pending, every probed element has a real action
verb and a substantive observation, every mentioned dialog reached the tree, every revealed
container has an open-path. Fix what it reports — by going back and probing, never by editing the
artifact to satisfy the rule. Then set `Meta.Phase: probed` and go to `finalize.md`.
