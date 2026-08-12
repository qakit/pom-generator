# Action safety allowlist

Applies to every browser interaction this skill performs via Playwright MCP, in every
stage (explore, generate, learn).

**Always allowed without asking:**
- Navigation to a URL
- Taking a snapshot / reading the accessibility tree
- Hovering over an element
- Clicking a link or icon that only navigates or opens a view (no data mutation)

**Never do without explicit, per-instance user permission:**
- Submitting any form
- Clicking any control whose accessible name or role suggests a mutating action:
  Delete, Remove, Confirm, Submit, Send, Pay, Approve, Reject, Save (when it persists
  data rather than just closing a local UI state), Logout
- Any action that would trigger a POST/PUT/PATCH/DELETE network request
- Filling in and submitting authentication forms (session comes from an already
  authenticated storageState — this skill never logs in itself)

**When unsure whether an action is safe:** stop and ask the user rather than guessing.
A wrong guess on a destructive action can corrupt real data in the target application.
