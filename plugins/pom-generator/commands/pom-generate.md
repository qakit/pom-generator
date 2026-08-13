---
description: Generate Page Object files from a validated analysis artifact
argument-hint: <slug>
---

Generate Page Objects from the analysis artifact for: **$ARGUMENTS**

(If no slug is given, list the directories under `.pom-generator/analysis/` and ask which one.)

## Gate — do this first

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" .pom-generator/analysis/$ARGUMENTS
```

Paste the actual output.

- **exit 1 (errors): stop and write nothing.** Show the report and tell the user the analysis is
  incomplete. The fix is to finish it — `/pom-analyze <url> --phase=<phase>` — not to generate
  anyway. Never edit the artifact to get past this gate.
- **exit 2 (warnings only):** proceed, and repeat the warnings in the final summary.
- **exit 0:** proceed.

If the artifact does not exist, stop and tell the user to run `/pom-analyze <url>` first.

## Then

1. **Read** `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/generate/emit.md` in full, and
   `generate/verify.md`. Do not work from a summary or from memory of a previous run.
2. Read `.pom-generator/conventions.md`, `component-registry.md`, the artifact, and one or two
   existing Page Objects closest in shape to what you are writing.
3. Emit per the output manifest — deepest component first, page last, barrel exports updated.
   Generate in the language and API style recorded in `conventions.md`, never a default assumption.
4. Run the project's own type-check/lint as recorded in `conventions.md`. Fix every error.
5. Verify against the live page per `references/generate/verify.md` — `browser_highlight` plus a screenshot for every
   getter, and **read the screenshots**. A selector that resolves to the wrong element is the
   failure this step exists to catch.
6. Update manifest rows to `written` / `verified`, set `Meta.Phase: generated`.

## Constraints

- **The artifact is the whole spec.** No getter for an element that is not in `## Elements`, no
  method for behaviour that is not in an `Observed:`, no selector that is not in a `Locator:`. A
  missing element is a gap in the analysis — say so, do not fill it.
- **Never overwrite a file that has been hand-edited since it was generated.** Check `git status`
  first; if it has changed, stop, show both versions, and ask. Suggest `/pom-learn` so the
  correction becomes a convention.
- Destructive and mutating actions are not executed during verification —
  `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/00-safety.md`. If a login page appears,
  tell the user and wait; never look for credentials.

## Finish

Present the diff, which elements reused registry classes vs. which are `REVIEW`-flagged as new,
what verification caught and fixed, any validator warnings, and anything `blocked-*` that is
therefore unverified in the generated code.
