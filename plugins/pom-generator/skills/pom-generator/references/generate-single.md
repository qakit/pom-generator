# Generate: single page

0. **Preflight.** Check whether `auth/storageState.json` exists in the project root
   (via a plain file check, not an MCP call). If it's missing, stop and tell the user
   they need to run their login/session script first (e.g. `npx tsx auth/auth.setup.ts`)
   — do not attempt to navigate/log in yourself. If the Playwright MCP tools aren't
   available at all (server not connected), tell the user to check `/mcp` and that the
   `playwright` server should have been added automatically when this plugin installed.

1. Read `.pom-generator/conventions.md` and `.pom-generator/component-registry.md`.
2. Open the target URL via the Playwright MCP tools (navigate, then snapshot).
3. Pick 1-2 existing Page Object files most similar in domain to the target page
   (form-heavy, table-heavy, dashboard, etc.) as style reference — read them.
4. For every distinct interactive/custom element in the snapshot, check it against
   `component-registry.md` before deciding how to wrap it:
   - Matches an existing entry → use that class.
   - Doesn't match anything → create a new wrapper following `conventions.md`
     structure/naming rules, and mark it `// REVIEW: new pattern, not in registry`.
5. Write the new Page Object file to the correct location per `conventions.md`'s
   folder structure. Add its export to the barrel/index file if one is used.
6. Run `tsc --noEmit` and the project linter on the new file(s). Fix any errors before
   presenting.
7. Show the diff and a short summary: which elements reused existing wrapper classes,
   which are new/REVIEW-flagged.

Respect `action-safety.md` at every step — only navigate, hover, and snapshot unless the
user explicitly asked you to perform a specific other action.
