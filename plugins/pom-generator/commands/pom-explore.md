---
description: Bootstrap or refresh .pom-generator/conventions.md and component-registry.md from the current framework code
argument-hint: [directories]
---

**Non-negotiable, every time:** if any navigation during this exploration reveals a login page or
redirects to an SSO/auth domain, that is a "not logged in" state. Tell the user and wait for them
to log in manually — never search the filesystem, grep for credentials, or read
`.env`/config/secrets files. Full rules:
`${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/00-safety.md`

Read `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/explore.md` in full and follow it
exactly, through all seven checkpointed sub-stages (0.0 to 0.6), **pausing for confirmation after
each one**. Never collapse several sub-stages into one pass — the checkpoint is what lets the user
catch a wrong inference before it propagates.

The registry entry format is in
`${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/registry-format.md`.

Target directories: **$ARGUMENTS**
(if empty, ask where the Page Object code lives, or infer from `src/pages`, `src/elements`,
`src/components` if present.)

Outputs go to `.pom-generator/` in the **user's repo** — `conventions.md`,
`component-registry.md`, `structure-notes.md`. Never into the skill's own folder.

Pay particular attention to sub-stage 0.4 (usage patterns). It is load-bearing: analysis and
generation both read it to decide what indexing methods return and whether navigation methods
chain. Record actual method signatures, not paraphrases.
