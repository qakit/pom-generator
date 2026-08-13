# Safety

**This file is the only copy of these rules.** Every command and every phase document points
here. If a rule about credentials, destructive actions, or login appears anywhere else in this
skill, it is a summary of this file and this file wins.

Applies to every browser interaction in every stage — explore, analyze, generate, learn.

---

## Rule 1 — Never go looking for credentials. No exceptions.

Not to determine login state. Not to speed anything up. Not because credentials happen to be
visible on screen. Not because the user seems to expect it. Not "just to check whether a session
file exists."

Specifically, never read, search, grep, glob, or list, for the purpose of finding login
information:

- `.env`, `.env.*`, or any dotfile that might hold configuration
- anything named or resembling `credentials`, `secrets`, `auth`, `token`, `password`, `keys`
- password managers, keychains, browser profile directories, cookie jars
- `localStorage` / `sessionStorage` / cookies via `browser_localstorage_*`,
  `browser_sessionstorage_*`, or `browser_cookie_*` — these MCP tools exist, and reading them to
  obtain or inspect a session is prohibited exactly like reading a file would be
- `browser_storage_state` / `browser_set_storage_state`

**Login state is determined only by looking at the rendered page.** Is there a login form? Was
there a redirect to an auth domain? Is the expected authenticated UI present? That is the entire
permitted method.

If the opt-in team/CI auth mode is configured (see `team-auth-mode.md`), this skill needs only
the *path* to an already-authenticated session file — never its contents, and never the
credentials that produced it.

## Rule 2 — Never log in on the user's behalf.

Login is a human action, always. Do not fill a login form, do not submit one, do not infer likely
credentials, do not reuse a value seen elsewhere in the session.

**The login-wait flow**, whenever a page turns out not to be logged in:

1. Tell the user plainly: a browser window is open, please log in there and say when you're done.
2. **Stop. Wait for their reply.** Do not continue the phase, do not probe anything, do not
   "work on something else in the meantime" that touches the browser.
3. When they confirm, re-navigate and re-check before proceeding.

A redirect to a different domain entirely — SSO, ADFS, OAuth, Okta, Entra, any identity provider —
is the same "not logged in" case and gets the same handling. It is never a signal to go hunting
for a way in.

The bundled MCP server runs headed with a **persistent browser profile** (no `--isolated`, no
`--storage-state`), so a successful manual login is remembered across future sessions. This is
normally a one-time step per project.

## Rule 3 — Never take a destructive or mutating action without explicit, per-instance permission.

"Per-instance" means: permission for *this* click, on *this* page, right now. Permission granted
for one button does not extend to another button, to the same button on a different page, or to a
later run.

**Always allowed, no need to ask:**

| Action | Tool |
|---|---|
| Navigate to a URL | `browser_navigate`, `browser_navigate_back` |
| Read the accessibility tree | `browser_snapshot`, `browser_find` |
| Screenshot page, region, or element | `browser_take_screenshot` |
| Hover | `browser_hover` |
| Highlight an element to confirm a locator | `browser_highlight`, `browser_hide_highlight` |
| Read what requests fired | `browser_network_requests`, `browser_network_request` |
| Read console output | `browser_console_messages` |
| Click a control that only navigates or reveals a view | `browser_click` |
| **Open a dialog/modal/drawer to analyze it** | `browser_click` |
| Type a short probe value into a text input, then clear it | `browser_type` |
| Select a dropdown value, then restore it | `browser_select_option` |
| Toggle a checkbox, then toggle it back | `browser_click` |
| Resize the viewport | `browser_resize` |
| Wait for settling | `browser_wait_for` |

Opening a dialog to analyze its structure is **required exploration**, not a risky action. Probing
a filter control is likewise expected — filters are read operations with a UI side effect, and the
reset step puts them back.

**Never without explicit permission for that specific instance:**

- Submitting any form (`browser_type` with `submit: true`, `browser_fill_form`, pressing Enter in
  a form field, clicking a submit control)
- Clicking any control whose accessible name or role suggests: **Delete, Remove, Discard, Confirm,
  Submit, Send, Pay, Approve, Reject, Publish, Archive, Logout** — or **Save/Apply** when it
  persists data rather than just closing a local UI state
- Anything that would fire a POST / PUT / PATCH / DELETE
- `browser_file_upload`, `browser_drop`, `browser_drag` when the drop target performs a real
  operation
- `browser_run_code_unsafe` — never, under any circumstance, in any phase of this skill
- `browser_route`, `browser_unroute`, `browser_network_state_set` — mocking or cutting the
  network changes what the app does and invalidates the analysis; never used here

**A dialog with Save / Apply / Filter buttons:** understanding its *structure* is the goal and is
always safe. Record what the buttons are and what they are for. Close it with Cancel or Escape.
Clicking Save is a separate decision that needs its own permission.

## Rule 4 — When unsure, stop and ask.

A wrong guess on a destructive action corrupts real data in a real application. There is no
recovery step in this skill for that. Asking costs one message.

## Rule 5 — Probe data must be obviously synthetic and must be cleaned up.

When typing a probe value, use something unmistakably not-real (`zzprobe`, `test-probe-1`). Never
type something that could be mistaken for genuine data if it were accidentally persisted. Clear
it afterwards and confirm the field is empty before moving on.

---

## Recording a refusal

If a safety rule blocks part of an analysis, that element is not silently dropped. Record it in
the artifact as:

```
**Probe:** blocked — destructive control, permission not granted
**Status:** blocked-safety
```

The validator accepts `blocked-<reason>` as a terminal status and reports it in the summary, so
the gap is visible in the output rather than hidden. Mention it to the user when presenting the
phase result — they may want to grant permission for that one control and re-run.
