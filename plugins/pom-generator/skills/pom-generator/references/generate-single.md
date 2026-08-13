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
      is the checklist you'll work through, not an informal impression. **Note that
      some elements only become visible during interaction (e.g. a clear/X button
      inside a text input after typing, an autocomplete dropdown). These will be
      discovered during probing in step 4b and added to the inventory then — the
      initial inventory here is what's visible in the default page state.**
   a1. **Before finalizing this inventory, re-scan the snapshot region by region**
      (following the top-to-bottom, left-to-right traversal order in
      `element-behavior-analysis.md`) specifically looking for elements that are easy
      to miss on a first pass: icon-only buttons with no visible label (gear/settings
      icons, kebab/more-options icons), elements inside a filter panel/sidebar/toolbar
      container, and anything positioned away from the main content area (headers,
      side panels). A container itself being in the inventory is not sufficient —
      every actionable element *inside* it needs its own inventory line too.
   a2. **If a todo/task-tracking tool is available in this environment (e.g. TodoWrite),
      use it to register every item from the inventory above as its own individual
      task before probing anything** — one task per element, not one task for
      "analyze elements." Mark each task in-progress only while actually performing
      its probe, and completed only once a real observed outcome is recorded for it.
      This is not optional bookkeeping: relying on prose intention alone to probe
      "every element" has repeatedly failed in practice on large pages — a
      per-element task list makes an unprobed element structurally visible (still
      pending) rather than something that can be silently skipped while attention
      drifts to writing code. If no such tool is available, keep the same discipline
      manually — write the full inventory out as a literal checklist in your own
      working notes before starting, and don't let the list shrink from view as you
      go, e.g. by only mentally tracking "what's left."
   b. For **every single item** in that inventory, apply the matching procedure from
      `element-behavior-analysis.md` — actually perform the probing action (type into
      the input, click the button, select the dropdown value) and observe the real
      result. Do not classify an element's behavior from its label, name, or general
      appearance alone — probing is how this skill exists, skipping it defeats the
      point of using it. An element only counts as "analyzed" once you've actually
      interacted with it and recorded what happened, not once you've formed an
      opinion about what it probably does.
   b1. **Between each probe: restore clean page state.** After probing element N, close
      whatever opened (dropdown, dialog, calendar) and verify the page is back to
      baseline before probing element N+1. **If you cannot restore clean state**
      (an overlay won't dismiss, a dialog has no close button, the page state is
      ambiguous), **navigate to the page URL again** — this is the correct and
      preferred recovery, not a workaround. A stale overlay from a prior probe
      blocking the next probe is the most common cause of analysis failure.
   b2. **"Observed" is not a valid outcome for any actionable element** — any button,
      checkbox, link, toggle, tab, or icon-as-button. "Observed" only ever means "I saw
      this static/decorative element in the snapshot and it needs no interaction"
      (e.g. a text label, a status badge with no click handler). If an element can be
      clicked, typed into, or selected, its recorded outcome must be a real action —
      Typed/Clicked/Selected — never "Observed", and never inferred from what a
      *different* element on the page turned out to do. Two buttons with similar
      labels or in similar positions can behave completely differently — a button
      labeled "Create X" is not guaranteed to behave like a button labeled "Open X" or
      like a row's action button elsewhere on the same page, even if earlier probing
      revealed that other button's behavior. Every actionable element gets its own
      real, independent probe — no exceptions, no analogies.
   b3. **The recorded action must match the element type — a lesser action never
      substitutes for the required one.** A text input requires typing into it, not
      just clicking it — clicking only proves it's focusable, it proves nothing about
      autocomplete/search/dropdown behavior. A dropdown requires actually selecting a
      value, not just opening and closing it. A checkbox requires actually toggling
      it, not just noting it exists. If you find yourself writing a conclusion like "it
      doesn't do X" based on an action lighter than what that element type requires
      (see `element-behavior-analysis.md` for the exact required action per type),
      that conclusion is unearned — go back and perform the actual required action.
   c. **Opening a dialog is not a stopping point or something to defer — it's a
      trigger to recurse, and the task-tracking discipline from step a2 extends here
      too.** If a button click opens a dialog/modal/popup, do the following immediately
      before returning to the parent inventory:
      i. Snapshot the dialog. Build a separate sub-inventory of every interactive
         element inside it (buttons, inputs, tabs, close icon, etc.).
      ii. If task tracking is in use, register each dialog element as its own new task
          — same discipline as step a2. Dialog elements discovered mid-probing are
          exactly the ones that get silently dropped without this.
      iii. Probe every element in the dialog using the same rules (step 4b, b2, b3).
          If a dialog element opens another dialog, recurse again.
      iv. After probing, this dialog **must become its own generated component file**
          (per `conventions.md` component structure), not just inline getters on the
          parent page. The parent page object references the dialog component via its
          opener method (e.g. `clickSettingsButton()` returns `SettingsDialog`).
      v. Do not collapse this into "the dialog has a Save and a Cancel" and move on —
         actually write the file. An analyzed dialog without a generated component file
         is unfinished work.
      vi. **After finishing dialog analysis, reload the initial page URL to return to
          clean state.** Do not try to close the dialog and continue — dialog close
          actions frequently leave behind overlays or changed state. Reloading is the
          correct and expected recovery, not a failure.
      Skip recursion only if you've already analyzed an identical dialog structure
      (same component, same layout) earlier in this same run.
   d. Before moving to step 5, do a pass over your inventory from 4a and confirm every
      item has an actual observed result next to it (probed → outcome), not a blank or
      an inference. **Specifically check the Probe/action column of every actionable
      row — if it says "Observed" or is otherwise not a real action verb
      (Typed/Clicked/Selected/Hovered), that item is not actually done: go back and
      probe it now, before writing any code.** **Also check that each probe result
      reflects a real interaction, not an inference — e.g. "collapsed the group buttons"
      for a button that was actually clicked and verified to collapse is correct, but
      "opens a dialog" for a button that was NOT clicked is wrong.**
   d1. **Also audit the side effects: for every element whose probe opened a dialog,
      confirm a component file was actually generated for that dialog (per step 4c-iv).**
      List each dialog and its corresponding output file. If a dialog was analyzed but
      has no file, that work is not complete — generate the component now before
      proceeding. There is no later step that revisits this.
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
   Include the element inventory from step 4a with each item's observed outcome, using
   a real action verb (Typed/Clicked/Selected/Hovered) for every actionable element —
   if any row in this final table says "Observed" for something clickable, that is a
   sign the analysis is incomplete and step 4 must be revisited before presenting,
   not a cosmetic detail to fix later.

Respect `action-safety.md` at every step — only navigate, hover, and snapshot unless the
user explicitly asked you to perform a specific other action.
