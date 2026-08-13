---
description: Analyze a manual correction to a generated Page Object and, if it's a systemic pattern, update conventions.md or component-registry.md (with confirmation)
argument-hint: [file]
---

Read `${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/learn-from-diff.md` first, and follow
it precisely. The registry entry format is in
`${CLAUDE_PLUGIN_ROOT}/skills/pom-generator/references/registry-format.md`.

Target file: **$ARGUMENTS**
(if empty, use the most recently modified file under the Page Object directories recorded in
`.pom-generator/conventions.md`.)

The core rule: distinguish a one-off fix from a systemic pattern, and write only systemic patterns
back into `conventions.md` or `component-registry.md` — always showing the proposed change and
getting confirmation before saving.

If the corrected file has a corresponding analysis artifact under `.pom-generator/analysis/`, check
whether the correction also implies the **artifact** was wrong — a mis-recorded `Locator:` or a
wrong `Type:`. If so, say which, so the next regeneration does not reintroduce the same defect.
