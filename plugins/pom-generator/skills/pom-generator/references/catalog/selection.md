# Catalog — Selection

Controls where the user picks from a fixed set. The family rule:

> **Opening a control is not selecting from it.** Expanding a dropdown and closing it again proves
> the list opens. It proves nothing about what selecting does — which is the thing a test will
> actually do. Every entry here requires committing to a value and observing the consequence.

The second family rule: **selection controls are the most common source of cascading dependencies.**
Choosing a country repopulates the state list; choosing a type enables three fields and hides two.
Whatever a selection changes goes in `Affects:`, and anything it brings into existence is probed
in turn.

---

## selection/single-select
**Aliases:** dropdown, select, picker, combobox
**Identify:** `select`, or `role=combobox` with `aria-haspopup=listbox`; a chevron; the control displays the current value
**Not:** `selection/multi-select` (chips or checkmarks persist); `inputs/autocomplete` (accepts typing); `actions/menu` (items are commands, not values — nothing stays selected)
**Required probe:** `browser_select_option` for a native `select`; otherwise click to open, then click an option. **Actually commit to a value**
**Observe:** the full option list (record the options — a test will assert on them), the request fired, what changed on the page, what the closed control now displays
**Reset:** re-select the original value and confirm the page returned to baseline; if unclear, reload
**Reveals:** for a custom control, the opened list is its own component (`C-nn`) containing `selection/option` elements
**Wrapper shape:** `select(label)`, `getSelected()`, `getOptions()`, `isDisabled()`

## selection/option
**Aliases:** listbox item, dropdown row
**Identify:** `role=option` or a row inside an opened list; hover highlight; may carry a checkmark or icon
**Not:** `actions/menu` items (they run a command); `collections/list` rows (they are data, not a choice)
**Required probe:** click it, from inside the opened parent
**Observe:** does the list close on selection (single) or stay open (multi)? does the parent's displayed value update? is a chip created?
**Reset:** handled by the parent control's reset
**Wrapper shape:** usually not its own class — options are addressed through the list component's `selectOption(text)`. Give it a class only if a row has internal structure worth reaching (avatar, secondary text, per-row action)

## selection/multi-select
**Aliases:** tag picker, chip select, multi-combobox
**Identify:** several values shown at once as chips/tokens, or checkmarks that persist in an open list; `aria-multiselectable`
**Not:** `selection/single-select`; `selection/checkbox` (independent controls, not one control holding many values)
**Required probe:** select **two** values, then remove one. Single-selection does not exercise the behaviour that distinguishes this type
**Observe:** where selected values render, whether the list stays open, whether there is a "select all"/"clear all", how removal works (chip X, re-click the option, backspace), any max-selection limit
**Reset:** remove all added selections and confirm the original set
**Reveals:** the option list; each chip and each chip-remove button
**Wrapper shape:** `select(labels[])`, `deselect(label)`, `getSelected()`, `clearAll()`, `getOptions()`

## selection/radio-group
**Aliases:** radio buttons, option group
**Identify:** two or more `input[type=radio]` sharing a name, or `role=radiogroup`; all options visible at once; exactly one selected
**Not:** `selection/segmented` (styled as a joined button bar); `selection/checkbox` (independent)
**Required probe:** select an option **other than the current one**, and observe. Clicking the already-selected option proves nothing
**Observe:** what changes elsewhere — radio groups very often gate other fields; whether the group can be cleared at all
**Reset:** re-select the original option
**Wrapper shape:** the group is one component: `select(label)`, `getSelected()`, `getOptions()`. Individual radios are not separate classes

## selection/checkbox
**Aliases:** tickbox
**Identify:** `input[type=checkbox]` or `role=checkbox`; independent on/off; may have an indeterminate state
**Not:** `selection/toggle` (switch styling, applies immediately); `selection/radio-group` (mutually exclusive)
**Required probe:** toggle it, observe, **toggle it back**. A checkbox left checked filters data for every subsequent probe on the page — this is the most common cause of a corrupted analysis run
**Observe:** does it apply immediately or need an Apply button? does it filter a collection? does it enable other controls? is there an indeterminate parent checkbox?
**Reset:** toggle back to the original state and verify with a snapshot. If the click is blocked, reload
**Wrapper shape:** `check()`, `uncheck()`, `toggle()`, `isChecked()`, `isIndeterminate()`

## selection/toggle
**Aliases:** switch, on/off
**Identify:** a track with a sliding knob; `role=switch`; changes apply immediately with no confirm step
**Not:** `selection/checkbox` — behaviourally similar, but a toggle usually commits immediately and often fires a request. If flipping it persists a setting, it is a **mutating action** needing permission per `00-safety.md`
**Required probe:** if it only changes local UI state, toggle and toggle back. **If it persists a setting, do not flip it** — record `Status: blocked-safety` and note what it appears to control
**Observe:** the request fired, the confirmation toast, what section appeared or disappeared
**Reset:** toggle back and confirm
**Wrapper shape:** `turnOn()`, `turnOff()`, `isOn()`

## selection/slider
**Aliases:** range, track
**Identify:** `input[type=range]` or `role=slider`; a draggable handle on a track; sometimes two handles for a range
**Not:** `inputs/number`
**Required probe:** move it — `browser_press_key` with arrow keys after focusing is more reliable than dragging, and counts as a real probe. For a two-handle range, move both
**Observe:** min, max, step, whether a value label follows the handle, whether it commits live or on release
**Reset:** return to the original value
**Wrapper shape:** `setValue(n)`, `getValue()`, `getMin()`, `getMax()`; for ranges `setRange(from, to)`

## selection/segmented
**Aliases:** button group, view switcher, pill toggle
**Identify:** two to five buttons joined into one bar, exactly one visibly active; often view switches (List | Grid | Map)
**Not:** `actions/button` (independent actions); `containers/tabs` (switches a whole panel of content)
**Required probe:** click a segment other than the active one
**Observe:** what the page swaps to — if it replaces a large content area, the revealed content is its own analysis target, exactly like a tab
**Reset:** click back to the originally-active segment. Leaving a different segment active changes what every later probe sees
**Reveals:** whatever each segment displays
**Wrapper shape:** `select(label)`, `getActive()`, `getSegments()`
