---
name: pom-generator
description: Use this skill for anything related to generating, updating, or maintaining Page Object wrappers (Playwright, any language) from a real running application. Trigger this whenever the user asks to "wrap a page", "generate a page object", "create a POM", "analyze a page", "explore the framework", "learn my conventions", or mentions component-registry, page objects, or test framework wrappers. Also trigger after the user manually edits a generated Page Object and wants the skill to learn from the correction. Push to use this proactively any time a Playwright test framework and a page-wrapping task come up together, even if the user doesn't name the skill explicitly.
---

# Playwright POM Generator

Generates Page Object wrappers — pages, components, elements — that match the conventions of the
user's own codebase rather than generic boilerplate. Language-neutral: TypeScript, JavaScript,
Python or any other Playwright binding, detected from the project rather than assumed.

This file is a **router**. It says which document to read; it does not contain procedures.

All paths below are literal and resolve at load time. Read them directly — there is no need to
search for them.

---

## Pick the stage

| The user wants | Command | Read |
|---|---|---|
| To learn this repo's framework conventions | `/pom-explore` | `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/explore.md` |
| To analyze one page | `/pom-analyze <url>` | `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/analyze/pipeline.md` |
| To analyze a multi-step flow | `/pom-analyze-flow <route.yml>` | `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/analyze/flow.md` |
| To write the Page Object code | `/pom-generate <slug>` | `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/generate/emit.md` |
| To absorb a manual correction | `/pom-learn [file]` | `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/learn-from-diff.md` |

Prerequisites run in order: **explore → analyze → generate**. Analysis requires
`.pom-generator/conventions.md`; generation requires a validated analysis artifact.

## How the pieces fit

```
/pom-explore   →  .pom-generator/conventions.md            what this codebase's style is
                  .pom-generator/component-registry.md     what is already wrapped

/pom-analyze   →  .pom-generator/analysis/<slug>/analysis.md
                  a strict, validated record of every element on a real page:
                  what it is, what it actually does when you interact with it,
                  and which class should wrap it.  No code is written.

/pom-generate  →  src/pages/…, src/components/…
                  written from the artifact alone, then verified against the live page.
```

The split between analyze and generate is deliberate. Probing a page and writing code are
different jobs, and interleaving them is what causes elements to be silently dropped. The artifact
is the contract between them, and a validator enforces it:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" .pom-generator/analysis/<slug>
```

Exit 1 means the analysis is incomplete and **no code may be generated**.

## Three kinds of reference document

Knowing which kind you need is how you find the right file quickly.

| Kind | Where | Answers |
|---|---|---|
| **Procedure** | `references/analyze/`, `references/generate/` | What do I do next? |
| **Invariant** | `references/rules/` | What must be true? |
| **Lookup** | `references/catalog/` | How do I probe a `<type>`? |

Foundations that apply everywhere, in `references/`:

- `00-safety.md` — credentials, login, destructive actions. **The only copy of these rules**
- `01-glossary.md` — element / component / page / flow, IDs, statuses, action verbs
- `02-artifact-schema.md` — the artifact grammar and every validator rule
- `03-toolbelt.md` — which Playwright MCP tool for which purpose
- `registry-format.md` — the `component-registry.md` entry format
- `team-auth-mode.md` — opt-in portable/CI session, not the default

## Safety — summary only

The full and authoritative rules are in `references/00-safety.md`. Read it. In brief:

- **Never** search for, read, or handle credentials of any kind — files, config, secrets, browser
  storage, cookies — for any reason, including determining login state. Login state is read only
  from the rendered page.
- **Never** log in on the user's behalf. If a page is not logged in, say so and **wait**.
- **Never** submit a form, or click Delete / Confirm / Send / Pay / Approve / Save-that-persists,
  without explicit permission for that specific control at that moment.
- Navigating, snapshotting, screenshotting, hovering, highlighting, opening a dialog to analyze it,
  and typing a synthetic probe value that you then clear — all fine, no need to ask.
