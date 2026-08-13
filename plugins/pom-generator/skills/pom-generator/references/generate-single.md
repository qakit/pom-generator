# Generate: single page

0. **Preflight — navigate and check login state.**
   - Confirm the Playwright MCP tools are available. If not, tell the user to check
     `/mcp` — the `playwright` server should have connected automatically when the
     plugin installed.
   - Navigate to the target URL and take a snapshot.
   - Determine whether the page looks logged in **using only the rendered page** —
     absence of a login form/redirect, presence of expected authenticated UI (nav bar,
     user menu, etc — infer from the snapshot; ask the user what "logged in" looks
     like on first use if unclear). **This includes being redirected to a different
     domain entirely (SSO/ADFS/OAuth providers, etc.) — a redirect to any login page,
     on any domain, is the same "not logged in" case, handled the same way below.**
     Never search the filesystem, grep, or read any
     file (`.env`, config, credentials, secrets, etc.) to determine or obtain login
     info — this is an absolute rule, see `action-safety.md`.
   - **If not logged in:** tell the user plainly, e.g. "This page isn't logged in — a
     browser window should be open. Please log in there, then tell me when you're done."
     Then **stop and wait for the user's next message** — do not attempt to fill in any
     login form yourself, look for credentials anywhere, or guess at values. Once the
     user confirms, re-navigate/snapshot to verify login succeeded before proceeding.
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
4. **Element behavior analysis — mandatory, blocking.** Read
   `references/element-behavior-analysis.md` in full before doing anything else in
   this step; do not proceed from memory or from a prior read.
   a. Build an explicit inventory of every distinct interactive/custom element visible
      in the snapshot (every input, button, icon-as-button, dropdown, tab, and any
      container that groups them). List them before probing any of them — this list
      is the checklist you'll work through, not an informal impression.
   b. For **every single item** in that inventory, apply the matching procedure from
      `element-behavior-analysis.md` — actually perform the probing action (type into
      the input, click the button, select the dropdown value) and observe the real
      result. Do not classify an element's behavior from its label, name, or general
      appearance alone — probing is how this skill exists, skipping it defeats the
      point of using it. An element only counts as "analyzed" once you've actually
      interacted with it and recorded what happened, not once you've formed an
      opinion about what it probably does.
   c. **Opening a dialog is not a stopping point or something to defer — it's a
      trigger to recurse.** If a button opens a dialog, analyze the dialog's full
      contents using this same inventory-then-probe process before returning to the
      parent inventory. Do not note "this opens a dialog" and move on without
      actually opening and analyzing it, unless you've already covered an identical
      dialog structure earlier in this same run.
   d. Before moving to step 5, do a pass over your inventory from 4a and confirm every
      item has an actual observed result next to it (probed → outcome), not a blank or
      an inference. Any item still unprobed at this point must be probed now, not
      deferred to "a future pass" — there is no later step that revisits this.
   e. Then check each analyzed element against `component-registry.md`:
   - Matches an existing entry → use that class.
   - Doesn't match anything → create a new wrapper following `conventions.md`
     structure/naming rules and the architecture philosophy in
     `element-behavior-analysis.md` (components stay separate, mirror real UI
     nesting), and mark it `// REVIEW: new pattern, not in registry`.
5. Write the new Page Object file to the correct location per `conventions.md`'s
   folder structure. Add its export to the barrel/index file if one is used.
6. **Self-verify.** Follow the "Self-verification" procedure in
   `element-behavior-analysis.md` — exercise the generated getters/methods against the
   live page before presenting, and fix anything that doesn't actually resolve/work.
7. Run the type-check/lint tooling detected in `conventions.md` (Stage 0.0/0.6) on
   the new file(s). Fix any errors before presenting.
8. Show the diff and a short summary: which elements reused existing wrapper classes,
   which are new/REVIEW-flagged, and anything the self-verify step caught and fixed.
   Include the element inventory from step 4a with each item's observed outcome, so
   it's visible that every element was actually probed rather than assumed.

Respect `action-safety.md` at every step — only navigate, hover, and snapshot unless the
user explicitly asked you to perform a specific other action.
