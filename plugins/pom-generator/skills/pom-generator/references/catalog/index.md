# Element catalog — index

A **lookup**, not a procedure. You arrive here with an element whose type you have hypothesised
from its appearance and its DOM; you leave with the exact action required to probe it, what to
watch for, and how to put the page back.

Every element in `analysis.md` carries a `**Type:**` from the canonical list below. The validator
rejects a type that is not on this list (V013), which is what keeps the vocabulary from drifting
into free-form description.

## How to use an entry

1. Hypothesise the type from **visual appearance and DOM together** — neither alone is sufficient
   (`rules/element.md`).
2. Read the entry's `**Not:**` line before committing. It exists because these types are
   routinely confused, and a wrong type means the wrong probe, which means an unearned conclusion.
3. Perform the `**Required probe:**` exactly. A lighter action never substitutes: clicking a text
   input proves it is focusable and nothing else.
4. Record what the `**Observe:**` line asks for, in `Observed:`.
5. Perform the `**Reset:**` and confirm baseline before the next element.
6. If `**Reveals:**` applies, the revealed thing gets its own IDs and enters the probe queue.

## When nothing matches

Use `other/unknown`, and probe it the way a user would: interact, observe what actually changed,
reset. The validator emits warning W003 so it surfaces at the gate rather than disappearing.
Mention it to the user — a recurring `other/unknown` is a missing catalog entry worth adding.

Do **not** force an element into a near-miss type to avoid the warning. A wrong type produces a
wrong probe and a wrong wrapper; an honest `other/unknown` produces a correct one plus a note.

## Canonical type ids

**Inputs** — see `inputs.md`

- `inputs/text` — single-line free text
- `inputs/textarea` — multi-line free text
- `inputs/number` — numeric, usually with steppers
- `inputs/search` — filters or queries something as you type
- `inputs/autocomplete` — typing opens a suggestion list you pick from
- `inputs/password` — masked credential entry
- `inputs/file` — file chooser
- `inputs/rich-text` — WYSIWYG / contenteditable with a formatting toolbar
- `inputs/masked` — enforced format: phone, card, time, currency

**Selection** — see `selection.md`

- `selection/single-select` — pick one from a list
- `selection/multi-select` — pick several, usually rendered as chips
- `selection/radio-group` — mutually exclusive visible options
- `selection/checkbox` — independent on/off
- `selection/toggle` — switch, on/off, applies immediately
- `selection/slider` — continuous or stepped range
- `selection/segmented` — button group acting as one exclusive choice
- `selection/option` — a single item inside an opened select, listbox or option list

**Actions** — see `actions.md`

- `actions/button` — labelled action control
- `actions/icon-button` — icon only, no visible label
- `actions/link` — navigates via href
- `actions/menu` — opens a list of commands
- `actions/split-button` — primary action plus a dropdown of alternates

**Containers** — see `containers.md`

- `containers/dialog` — modal overlay, blocks the page behind it
- `containers/drawer` — panel sliding from an edge
- `containers/panel` — persistent grouped area: filter bar, sidebar, toolbar
- `containers/card` — repeated self-contained unit
- `containers/accordion` — collapsible section with a header
- `containers/tabs` — tab strip plus the panel it switches
- `containers/tooltip` — hover-revealed text
- `containers/toast` — transient notification
- `containers/popover` — click-revealed non-modal overlay

**Collections** — see `collections.md`

- `collections/table` — rows and columns with a header
- `collections/grid` — tiled repeated items
- `collections/list` — vertical repeated items
- `collections/tree` — nested expandable hierarchy
- `collections/pagination` — page controls for a collection
- `collections/sortable-header` — a column header that reorders data
- `collections/virtualized-list` — only renders what is on screen

**Temporal** — see `temporal.md`

- `temporal/date` — single date
- `temporal/datetime` — date plus time
- `temporal/date-range` — start and end
- `temporal/calendar` — the month grid itself, as a component

**Other**

- `other/text-label` — static text, no interaction
- `other/status-badge` — static state indicator
- `other/image` — static image or avatar
- `other/unknown` — matched nothing above

`other/*` types are `Kind: static` except `other/unknown`, which must be probed like anything
else until proven otherwise.
