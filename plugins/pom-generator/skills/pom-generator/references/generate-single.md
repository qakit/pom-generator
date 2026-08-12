# Generate: single page

0. **Preflight — navigate and check login state.**
   - Confirm the Playwright MCP tools are available. If not, tell the user to check
     `/mcp` — the `playwright` server should have connected automatically when the
     plugin installed.
   - Navigate to the target URL and take a snapshot.
   - Determine whether the page looks logged in: absence of a login form/redirect to a
     login URL, presence of expected authenticated UI (nav bar, user menu, etc — infer
     from the snapshot; ask the user what "logged in" looks like on first use if unclear).
   - **If not logged in:** tell the user plainly, e.g. "This page isn't logged in — a
     browser window should be open. Please log in there, then tell me when you're done."
     Then **stop and wait for the user's next message** — do not attempt to fill in any
     login form yourself, even if credentials are visible on the page (see
     `action-safety.md`). Once the user confirms, re-navigate/snapshot to verify login
     succeeded before proceeding.
   - Because the MCP server runs with a **persistent browser profile by default**
     (no `--isolated`, no `--storage-state`), a successful manual login here is
     remembered automatically for all future runs in this project — there is no
     separate session file to generate or maintain. The user only does this once
     per project (or again later if the session naturally expires).
   - If the user's team instead wants a portable/CI-shareable session, see
     `references/team-auth-mode.md` for the alternative `--storage-state` setup —
     that's opt-in, not the default.

1. Read `.pom-generator/conventions.md` and `.pom-generator/component-registry.md`.
2. Take a snapshot of the target page (already navigated in step 0).
3. Pick 1-2 existing Page Object files most similar in domain to the target page
   (form-heavy, table-heavy, dashboard, etc.) as style reference — read them.
4. For every distinct interactive/custom element in the snapshot, check it against
   `component-registry.md` before deciding how to wrap it:
   - Matches an existing entry → use that class.
   - Doesn't match anything → create a new wrapper following `conventions.md`
     structure/naming rules, and mark it `// REVIEW: new pattern, not in registry`.
5. Write the new Page Object file to the correct location per `conventions.md`'s
   folder structure. Add its export to the barrel/index file if one is used.
6. Run the type-check/lint tooling detected in `conventions.md` (Stage 0.0/0.6) on
   the new file(s). Fix any errors before presenting.
7. Show the diff and a short summary: which elements reused existing wrapper classes,
   which are new/REVIEW-flagged.

Respect `action-safety.md` at every step — only navigate, hover, and snapshot unless the
user explicitly asked you to perform a specific other action.
