# Generate: multi-step flow

Use when wrapping a navigation flow: start page → click something → modal or new page →
possibly further steps.

The user provides a route description, either inline or as a YAML file:

```yaml
start: https://app.example.com/profiles
steps:
  - action: click
    target: "profile icon in the first table row"
    expect: modal        # modal | new_page | same_page
    output: ProfileDetails
  - action: click
    target: "Settings button in the header"
    expect: new_page
    output: SettingsPage
```

Procedure:

0. **Preflight — navigate and check login state.** Same check as step 0 in
   `generate-single.md`: navigate to `start`, snapshot, determine if logged in
   **using only the rendered page — never by searching the filesystem or any file for
   credentials, under any circumstance (see `action-safety.md`)**. If not logged in,
   tell the user a browser window is open for them to log in, and wait for their
   confirmation before proceeding. Thanks to the MCP server's persistent profile
   (no `--isolated`/`--storage-state` by default), this is a one-time thing per project.

1. Read `.pom-generator/conventions.md` and `component-registry.md`.
2. Open `start`, snapshot, generate the Page Object for the starting page (same
   procedure as `generate-single.md`, including the full element-behavior-analysis
   pass and self-verification step).
3. **Stop. Show the file. Wait for explicit confirmation before continuing.**
4. For each step in order:
   a. Locate the described element in the current snapshot, click it via MCP.
   b. Snapshot the resulting state.
   c. Compare actual result (URL changed? new dialog appeared? same page mutated?)
      against the step's `expect`. If it doesn't match, stop and ask the user —
      don't guess.
   d. Generate the output file as a Page (new URL) or a Component (dialog/same-page
      change), per `conventions.md` conventions for each — applying the **full
      mandatory inventory-then-probe process** from
      `references/element-behavior-analysis.md` to whatever this step revealed (its
      own inputs, buttons, dropdowns, nested dialogs, etc.). Build the element
      inventory for this step's revealed content and actually probe every item in it
      before writing the wrapper — same rule as `generate-single.md` step 4, this is
      not optional and not satisfied by a static read of the snapshot.
   e. Self-verify this step's generated wrapper (per `element-behavior-analysis.md`)
      before showing it.
   f. **Stop. Show the file. Wait for confirmation before the next step.**
5. After all steps: summarize created files and anything flagged `// REVIEW`.

Never combine steps without a checkpoint between them — the pause is what lets the user
catch a wrong navigation before it cascades into several wrong files.
