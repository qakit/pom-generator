# Action safety allowlist

Applies to every browser interaction this skill performs via Playwright MCP, in every
stage (explore, generate, learn).

## Absolute rule: never search for, read, or handle credentials — of any kind

This is not situational — it applies even while trying to determine login state, even
if credentials are visible on screen, even if the user seems to expect it, even if it
would obviously make the task faster.

- **Never** search the filesystem, grep, or read any file for the purpose of finding
  login credentials, tokens, API keys, or session data — this includes `.env` files,
  config files, password managers, browser storage, or anything named or resembling
  `credentials`, `secrets`, `auth`, `.env*`. Determining whether a page is logged in
  is done **only** by looking at the rendered page (snapshot/UI), never by looking for
  where credentials might be stored.
- **Never** attempt to log in on the user's behalf, under any framing — not by filling
  a form with values found somewhere, not by inferring likely credentials, not by
  reusing something seen elsewhere in the session. Login is a human action, always.
- If you don't know whether a page is logged in, ask the user or check the UI — do not
  go looking for a way to log in yourself as a shortcut.

**Always allowed without asking:**
- Navigation to a URL
- Taking a snapshot / reading the accessibility tree
- Hovering over an element
- Clicking a link or icon that only navigates or opens a view (no data mutation)
- Typing a short probe value into a text input to observe its behavior (per
  `element-behavior-analysis.md`), then clearing it afterward
- Opening a dialog/modal by clicking the button that reveals it, in order to analyze
  its structure — this is required exploration, not an optional/risky action

**Never do without explicit, per-instance user permission:**
- Submitting any form
- Clicking any control whose accessible name or role suggests a mutating action:
  Delete, Remove, Confirm, Submit, Send, Pay, Approve, Reject, Save (when it persists
  data rather than just closing a local UI state), Logout
- Any action that would trigger a POST/PUT/PATCH/DELETE network request

**When unsure whether an action is safe:** stop and ask the user rather than guessing.
A wrong guess on a destructive action can corrupt real data in the target application.
