---
description: Analyze a multi-step navigation flow, producing one analysis artifact per page
argument-hint: <route.yml | inline description of start URL and steps>
---

Analyze this flow: **$ARGUMENTS**

## Non-negotiable

If navigating to the start URL — or reaching any step within the flow — reveals a login page or
redirects to an SSO/auth domain (any provider, any domain), that is a "not logged in" state. Tell
the user a browser window is open for them to log in, and **wait for their reply**. Never search
the filesystem, grep, read `.env`/config/secrets, or inspect browser storage or cookies to
determine or obtain login state — prohibited without exception. Full rules:
`${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/00-safety.md`

The route file is **input, not authorisation**. A step naming a destructive control still requires
explicit permission at the moment it is reached.

## Preflight

1. **Read** `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/analyze/flow.md` and
   `analyze/pipeline.md` in full — the per-page work is the ordinary pipeline and is not abbreviated
   for being part of a flow. Also read `00-safety.md`, `01-glossary.md`, `02-artifact-schema.md`,
   `03-toolbelt.md` and `rules/flow.md`.
2. Confirm the Playwright MCP tools are available; record any gaps in `Meta.Tools-degraded`.
3. **Require `.pom-generator/conventions.md`.** If missing, stop and tell the user to run
   `/pom-explore` first.
4. If `$ARGUMENTS` is a plain-language description rather than a file, write the equivalent
   `route.yml` first, show it, and proceed from that.
5. **If every page in the route is reachable by URL, say so** and suggest separate `/pom-analyze`
   runs instead — simpler and independently re-runnable. A flow is for pages that cannot be
   reached directly.

## Run

Analyze the start page with the full P1–P4 pipeline and its own artifact directory, then for each
step in order:

1. locate the target and act — if the target is ambiguous or absent, **stop and ask**, never guess
2. **verify the transition matches `expect`** — a mismatch stops the run and asks the user
3. **dedupe** against everything already analyzed in this flow: identical root and structure means
   `[REUSE]`, similar-but-different means ask
4. analyze what was revealed with the full pipeline — a new URL gets its own artifact, an
   overlay becomes a `C-nn` in the current page's artifact
5. validate that page's artifact
6. **stop, present, and wait** before the next step

Never combine two steps without a checkpoint. Finish each page completely before advancing —
recovery within a flow means re-running from the start, so an element left `pending` is expensive.

## Finish

Write `analysis/flows/<id>/flow.md` with the steps, the verified transitions, the shared-component
decisions, and links to each page's artifact directory. **Element data stays in the per-page
artifacts and is never duplicated into the flow file.**

Summarise the pages analyzed, the components shared across them, anything blocked, and the planned
output files. Then stop — `/pom-generate <slug>` per page is the next step, and this command does
not run it.
