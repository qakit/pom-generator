# Catalog — Temporal

Dates and times. The family rule:

> **The picker is a component, not a detail of the field.** A date input that opens a calendar is
> two things: the field and the calendar. The calendar has month navigation, day cells, possibly
> year selection, presets, and a confirm button — a real interaction surface that a test will use.
> Wrapping the field with `fill("2026-08-13")` and ignoring the picker produces a wrapper that
> cannot exercise the control the way a user does.

Date controls are also the most likely to be already wrapped — a project uses one date picker
everywhere. **Check `component-registry.md` before creating anything here.** If a matching entry
exists, reuse it and note that you did; if not, this is a high-value new registry entry because
the next page will need it too.

---

## temporal/date
**Aliases:** date field, date picker
**Identify:** a field holding a single date; a calendar icon; clicking opens a month grid, or it is a native `input[type=date]`
**Not:** `temporal/date-range` (two values); `inputs/masked` (formats input but opens nothing)
**Required probe:** click the field, observe what opens, then **actually select a date** and confirm what the field displays. Both paths matter: also try typing into it, because many date fields accept both and the typed path is what tests usually use
**Observe:** the display format (this is what assertions will compare against — record it exactly), whether typing is accepted, whether there are min/max bounds, whether the picker closes on selection
**Reset:** clear the field or restore the original date; close the picker and **verify with a snapshot that it is gone**. An open calendar overlays the elements below it and will block the next probe
**Reveals:** the calendar, as a `C-nn` — see `temporal/calendar`
**Wrapper shape:** `setDate(value)` (typed path), `pickDate(value)` (picker path), `getDate()`, `clear()`, `openPicker()` returning the calendar component

## temporal/datetime
**Aliases:** date and time field, timestamp picker
**Identify:** as `temporal/date`, plus hour/minute controls — a time column beside the calendar, spinners, or a separate time field
**Not:** `temporal/date`
**Required probe:** set both halves. Setting only the date leaves the time behaviour untested, and the time half is frequently a different control type with its own quirks (12h/24h, minute step)
**Observe:** timezone handling if shown, 12h vs 24h, minute granularity, whether the time defaults to now or to midnight
**Reset:** restore the original value; close the picker and verify
**Reveals:** the calendar, and the time selector as its own sub-component
**Wrapper shape:** `setDateTime(value)`, `getDateTime()`, plus `setTime(value)` if the halves are independently addressable

## temporal/date-range
**Aliases:** range picker, from/to dates, period selector
**Identify:** two dates in one control — either two fields, or one field showing "start – end"; the calendar highlights a span
**Not:** two separate `temporal/date` elements that happen to sit next to each other. Check whether selecting the first constrains the second — if it does, it is one control
**Required probe:** select a **full range**, both ends. Selecting only a start leaves the range behaviour — the part that actually breaks — untested. Then check whether presets exist ("Last 7 days", "This month") and probe one, since presets are usually what a test uses
**Observe:** whether the second date is constrained by the first, whether the range applies live or on Apply, what the closed control displays, the preset list
**Reset:** restore the original range or reload
**Reveals:** the calendar (often dual-month), and the preset list as its own element group
**Wrapper shape:** `setRange(from, to)`, `selectPreset(label)`, `getRange()`, `clear()`, `getPresets()`

## temporal/calendar
**Aliases:** month grid, date-picker panel
**Identify:** the grid itself — weekday headers, day cells, month/year navigation. Usually revealed by one of the types above, occasionally embedded permanently in a page
**Not:** the field that opens it
**Required probe:** as a container. Its interior gets full treatment: navigate to the previous and next month and confirm the grid changes; click a day cell; check whether the month/year headers are themselves clickable (many open a month or year picker — a nested reveal that needs its own analysis); note disabled days and the today marker
**Observe:** how a day cell is addressable — an `aria-label` with a full date is the ideal locator target and is worth recording precisely; whether out-of-month days are shown and selectable; where the range highlight lives
**Reset:** the parent field's reset handles it — close and verify gone
**Reveals:** month/year sub-pickers if the headers are interactive
**Wrapper shape:** `selectDay(date)`, `nextMonth()`, `previousMonth()`, `goToMonth(month, year)`, `getVisibleMonth()`, `isDayDisabled(date)`. Address days by date value, never by grid position — cell position changes with every month
