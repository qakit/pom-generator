# Playwright MCP toolbelt

Which tool to reach for, with the parameters that matter. Read once at preflight.

Everything here is subject to `00-safety.md`, which lists the tools that are never used at all.

---

## Preflight capability probe

Tool availability varies with the installed `@playwright/mcp` version. At P0, check which of these
exist and record any that don't in `Meta.Tools-degraded`:

| Tool | If missing, fall back to |
|---|---|
| `browser_take_screenshot` with `target`/`element` | Full-page screenshots only; describe regions by position instead of cropping |
| `browser_snapshot` with `boxes` | Correlate visual regions to nodes by reading order and accessible names |
| `browser_generate_locator` | Skip `Locator-pw` / `Locator-agree`; note the degradation. Do **not** invent a value |
| `browser_highlight` | Verify locators with `browser_verify_element_visible` alone |
| `browser_verify_element_visible` / `_value` / `_list_visible` | Re-snapshot and confirm the element is present by ref |
| `browser_find` | Manual re-read of the snapshot for the completeness sweep |

A missing tool degrades the run; it never silently skips a step. If a degradation would make a
validator rule unsatisfiable (e.g. no element screenshots, so V015 can't pass), say so at the
gate and let the user decide, rather than fabricating a path.

---

## By purpose

### Seeing the page

| Purpose | Call |
|---|---|
| Full-page baseline | `browser_take_screenshot` `fullPage: true`, `filename: screens/baseline.png` |
| Region crop | `browser_take_screenshot` with `target`/`element` set to the region root |
| Element before/after pair | Same, named `screens/E-nn-before.png` / `-after.png` |
| Accessibility tree | `browser_snapshot` |
| Bounded subtree | `browser_snapshot` with `depth` — use when a page is large enough that a full snapshot drowns the detail |
| Node geometry | `browser_snapshot` with `boxes` — this is what lets a visual region be matched to real nodes |
| Text/regex sweep | `browser_find` — the P1 completeness cross-check |

**Screenshots are read as images, not just saved.** A file written and never looked at contributes
nothing. Every shot taken during survey and decomposition must actually be read.

### Inspecting

| Purpose | Call |
|---|---|
| Tag, classes, attributes, computed cursor | `browser_evaluate` on the element |
| Did a request fire | `browser_network_requests` with `filter` — take the count before, compare after |
| Full request detail | `browser_network_request` by index |
| Client-side errors during a probe | `browser_console_messages` with `level` |

`browser_evaluate` is the tool for the questions the accessibility snapshot cannot answer: does
this div have a click handler, what is its `cursor` style, what CSS-module class stem do these
siblings share. The class-stem answer is a primary component-boundary signal — see
`rules/component.md`.

### Acting

| Purpose | Call | Note |
|---|---|---|
| Click | `browser_click` | `doubleClick`, `button`, `modifiers` available |
| Type | `browser_type` | **Never set `submit: true`** unless the user gave permission for that exact submit |
| Select | `browser_select_option` | The required probe for a native select |
| Hover | `browser_hover` | For hover-revealed controls and tooltips |
| Keyboard | `browser_press_key` | `Escape` to dismiss, `Tab` to walk focus and find controls the snapshot missed |
| Resize | `browser_resize` | Set the viewport from `conventions.md` at P0 so results are reproducible |
| Wait | `browser_wait_for` | `text` / `textGone` beats a fixed `time` — use the deterministic form |

`browser_fill_form` is a bulk form filler and effectively a submit-shaped action. Not used for
probing; individual `browser_type` calls give per-element observations, which is the point.

### Resetting

Order of preference after a probe:

1. Undo the specific change — re-select the original value, toggle back, click the clear button.
2. `browser_press_key` `Escape` for overlays.
3. **`browser_navigate` to the page URL.** This is the correct recovery, not a workaround. Any
   time state is ambiguous, or after finishing a revealed dialog, reload. A stale overlay from a
   previous probe is the most common cause of a wrong classification on the next one.

### Verifying generated code

| Purpose | Call |
|---|---|
| Does this locator resolve, and to what | `browser_highlight` then `browser_take_screenshot` — see the highlight land on the intended element |
| Is it present | `browser_verify_element_visible` with `role` + `accessibleName` |
| Does it hold the expected value | `browser_verify_value` |
| Does a collection render as expected | `browser_verify_list_visible` |
| Playwright's own opinion on a locator | `browser_generate_locator` |
| Clean up after verification | `browser_hide_highlight` |

`browser_highlight` + screenshot is the strongest available check that a generated selector points
at the element you meant, as opposed to merely resolving to *something*. Zero matches and ambiguous
multi-matches are both failures — see `generate/verify.md`.

`browser_generate_locator` returns Playwright's canonical, page-rooted locator. It is a
cross-check, never the source of truth: it does not know the project's convention (`data-aid`
first, say) and it does not scope to a component root. Record it in `Locator-pw` and record
disagreement in `Locator-agree` rather than resolving it silently — a disagreement usually means
either the hand-authored selector is over-deep, or the element is genuinely ambiguous.

---

## Session and tabs

`browser_tabs` — a click that opens a new tab is a real navigation outcome. Record it in
`Observed:`, analyze the new tab as its own page (its own slug and artifact), and close or switch
back before continuing the parent inventory.

`browser_handle_dialog` — for *native* browser dialogs (`alert`, `confirm`, `beforeunload`), not
application modals. If a probe triggers a native `confirm`, dismiss it; accepting it is a mutating
action needing permission under `00-safety.md`.

Storage, cookie, routing, tracing, video, PDF and coordinate-based mouse tools are not used by
this skill. The storage and cookie families are additionally prohibited by `00-safety.md`.
