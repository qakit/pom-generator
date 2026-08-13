# Catalog — Inputs

Anything the user types into. The defining rule for this whole family:

> **Clicking a text input proves it is focusable and nothing else.** It tells you nothing about
> autocomplete, live search, validation, or masking. Every input in this family requires *typing*
> to be considered probed. A note reading "clicked it, no dropdown appeared" is an unearned
> conclusion — go back and type.

Use an obviously synthetic probe value (`zzprobe`, `123`) per `00-safety.md`, and clear it after.

**After typing, look at the whole input container, not just below it.** A clear (X) icon, a
character counter, a validation message, a spinner, an icon swapping from magnifier to X — these
appear only in the typed state, are trivially missed, and each is a real element that needs its
own ID and its own getter. This is the single most common source of a wrapper that works in
review and fails in a test.

---

## inputs/text
**Aliases:** text field, single-line input
**Identify:** `input` with type text/email/tel/url, or no type; single-line box; a label or placeholder
**Not:** `inputs/search` (filters something as you type); `inputs/autocomplete` (opens suggestions); `inputs/masked` (enforces a format)
**Required probe:** `browser_type` a short synthetic value. Typing is mandatory
**Observe:** does anything appear below (suggestions) or inside (clear icon, counter, validation)? does a request fire? does anything elsewhere on the page change?
**Reset:** clear the field, confirm it is empty
**Reveals:** a clear button, a validation message, a character counter — each gets its own element ID
**Wrapper shape:** `fill(value)`, `getValue()`, `isDisabled()`, plus getters for whatever the typed state revealed

## inputs/textarea
**Aliases:** multi-line, comment box, description field
**Identify:** `textarea`, or a contenteditable div with no formatting toolbar; visibly taller than one line; often a resize handle
**Not:** `inputs/rich-text` (has a formatting toolbar or produces markup)
**Required probe:** type a value including a newline — multi-line behaviour is the point
**Observe:** auto-grow, character/word counter, max-length truncation, whether Enter submits instead of adding a line
**Reset:** clear the field
**Wrapper shape:** `fill(value)`, `append(value)`, `getValue()`, `getCharacterCount()`

## inputs/number
**Aliases:** numeric field, stepper, quantity
**Identify:** `input[type=number]`, or a text input with up/down stepper affordances or numeric-only behaviour
**Not:** `selection/slider` (drag along a track)
**Required probe:** type a number, then click a stepper if present — both paths, they often behave differently
**Observe:** min/max clamping, rejection of non-numeric characters, step size, whether the value commits on blur or on change
**Reset:** restore the original value
**Reveals:** increment/decrement buttons are separate elements
**Wrapper shape:** `setValue(n)`, `increment()`, `decrement()`, `getValue()`

## inputs/search
**Aliases:** filter box, query field, quick find
**Identify:** magnifier icon, placeholder like "Search…", sits above a collection
**Not:** `inputs/autocomplete` — the distinction is *where results land*. Search updates a collection already on the page; autocomplete opens a floating suggestion list you pick from. If both happen, it is `inputs/autocomplete`
**Required probe:** type a value that will match something, and watch the collection
**Observe:** does it filter as you type or only on Enter? is it debounced? does a request fire, or is it client-side? what does the empty-result state look like?
**Reset:** clear via the X icon if one appeared, else select-all and delete; confirm the collection returned to its original count
**Reveals:** a clear button, a result-count label, an empty state
**Wrapper shape:** `search(text)` — named for what it does to the page, not `fill()`. Also `clear()`, `getResultCount()`

## inputs/autocomplete
**Aliases:** typeahead, combobox, lookup, async select
**Identify:** typing opens a floating list of suggestions; often `role=combobox` with `aria-expanded`, `aria-controls`
**Not:** `inputs/search`; `selection/single-select` (no typing, list is fixed)
**Required probe:** type a partial value, wait for the list, then **actually select an option**. Opening the list without choosing leaves the selection behaviour untested
**Observe:** minimum characters before it fires, debounce, the request, what the option rows contain (avatar? secondary line?), what the field shows after selection, whether a chip/token is created
**Reset:** clear the field or remove the created chip; confirm baseline
**Reveals:** the suggestion list is its own component (`C-nn`) with its own elements — including its loading and no-results states
**Wrapper shape:** `search(text)`, `selectOption(text)`, `getSuggestions()`, `getSelected()`, `clear()`

## inputs/password
**Aliases:** masked credential field
**Identify:** `input[type=password]`, dots instead of characters, often a reveal (eye) icon
**Not:** `inputs/masked` (format enforcement, not secrecy)
**Required probe:** **If this field is part of a login form, do not touch it** — `00-safety.md` Rule 2. Record `Status: blocked-safety`. If it is part of an ordinary application form (a "set a password for this new user" field), type a synthetic value
**Observe:** the reveal toggle, strength meter, validation rules text, confirm-field matching
**Reset:** clear the field
**Reveals:** reveal toggle, strength meter, rule checklist
**Wrapper shape:** `fill(value)`, `toggleReveal()`, `isMasked()`, `getStrength()`

## inputs/file
**Aliases:** upload, attach, drop zone
**Identify:** `input[type=file]`, a "Choose file"/"Browse" button, or a dashed drop zone
**Not:** `actions/button` — even if it looks like one, the file dialog behaviour makes it this type
**Required probe:** **Do not upload.** `browser_file_upload` is a mutating action needing explicit permission (`00-safety.md`). Probe by clicking to confirm the picker is wired, then dismiss; or by hovering the drop zone to observe its active state. Record what you did and did not do
**Observe:** accepted extensions, size limits stated in the UI, single vs multiple, the drop-zone hover state
**Reset:** dismiss any picker
**Reveals:** a file list, per-file remove buttons, a progress bar — these exist only after upload; note that they are unprobed
**Wrapper shape:** `upload(paths)`, `getAttachedFiles()`, `removeFile(name)`

## inputs/rich-text
**Aliases:** WYSIWYG, editor, contenteditable
**Identify:** a formatting toolbar (bold/italic/list) above an editable area; `contenteditable=true`
**Not:** `inputs/textarea` (no toolbar, plain text out)
**Required probe:** type text, then apply one formatting action and observe the markup change
**Observe:** which toolbar controls exist, whether the content model is HTML or markdown, whether the toolbar state reflects the cursor position
**Reset:** select all and delete; confirm empty
**Reveals:** the toolbar is its own component; each toolbar control is an element
**Wrapper shape:** `type(text)`, `applyFormat(name)`, `getHtml()`, `getText()`, `clear()`

## inputs/masked
**Aliases:** formatted input, phone/card/time field
**Identify:** typing reformats as you go — separators appear on their own; a placeholder showing a pattern like `__/__/____`
**Not:** `inputs/text`; `temporal/date` (opens a picker)
**Required probe:** type raw characters without separators and observe what the mask inserts. Then type something invalid and observe the rejection
**Observe:** where separators land, whether invalid characters are silently dropped, what `getValue()` would return — masked or raw. That distinction matters to every assertion written against it
**Reset:** clear the field
**Wrapper shape:** `fill(rawValue)`, `getFormattedValue()`, `getRawValue()`, `isValid()`
