---
description: Analyze a live page and write a strict analysis artifact (no code is generated)
argument-hint: <url> [--phase=<phase>]
---

Analyze this target and produce `.pom-generator/analysis/<slug>/analysis.md`: **$ARGUMENTS**

## Non-negotiable

If navigating reveals a login page, or redirects to an SSO/auth domain (any provider, any domain),
that is a "not logged in" state. Tell the user a browser window is open for them to log in, and
**wait for their reply**. Never search the filesystem, grep, read `.env`/config/secrets, or inspect
browser storage or cookies to determine or obtain login state — prohibited without exception, no
matter how convenient. Full rules: `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/00-safety.md`

## Preflight

1. **Read** `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/analyze/pipeline.md` in full.
   Do not work from a summary or from memory of a previous run. Also read `00-safety.md`,
   `01-glossary.md`, `02-artifact-schema.md` and `03-toolbelt.md` from the same `references/`
   directory.
2. **Confirm the Playwright MCP tools are available.** If not, tell the user to check `/mcp` — the
   `playwright` server connects automatically when the plugin is installed. Probe which optional
   tools exist per `03-toolbelt.md` and record any gaps in `Meta.Tools-degraded`.
3. **Require `.pom-generator/conventions.md`.** If it does not exist, stop and tell the user to run
   `/pom-explore` first — there is nothing to match a generated wrapper against without it. Read it
   and `component-registry.md` before anything else.
4. **Set the viewport** from `conventions.md` with `browser_resize`, and record it in `Meta.Viewport`.
5. **Navigate and check login state from the rendered page only.** Handle per the non-negotiable
   above.
6. If `.pom-generator/analysis/<slug>/analysis.md` already exists, this is a **re-analysis** — use
   delta mode (`references/analyze/pipeline.md`), never overwrite.

## Run

Work through the phases, reading each phase document before entering it:

| Phase | Document |
|---|---|
| P1 Inventory | `references/analyze/inventory.md` |
| P2 Probe | `references/analyze/probe.md` |
| P3 Finalize | `references/analyze/finalize.md` |

**Stop at the checkpoint (after inventory).** Present the region map, the recognition table, and
the probe list, and wait for the user's reply — do not start probing in the same turn. Probe and
finalize then run unattended.

Validate at every phase boundary and advance `Meta.Phase` only when it passes:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=<phase> .pom-generator/analysis/<slug>
```

Fix what the validator reports by doing the missing work — never by editing the artifact to satisfy
a rule.

If `$ARGUMENTS` contains `--phase=<phase>`, resume from that phase instead of starting at P1.

## Finish

Report counts (recognized / probed / static / blocked), registry reuse vs. new, anything blocked
and why, and the planned output files. Then stop — say that `/pom-generate <slug>` is the next step and do not run
it. No Page Object code is written by this command.
