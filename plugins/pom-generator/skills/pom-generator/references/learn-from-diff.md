# Learn from diff

Run when the user has manually corrected a file this skill generated, and wants the
correction reflected in future generations.

1. Run `git diff` on the file (or the specific file the user names).
2. Compare the pre-correction (generated) and post-correction (human-edited) versions.
3. Classify the change:
   - **One-off fix** (typo, unrelated bug, project-specific one-time detail) →
     acknowledge it, do not modify conventions.md or component-registry.md.
   - **Systemic pattern** (locator strategy choice, which wrapper class applies to a
     given DOM shape, naming convention, method structure, how an edge case is
     handled) → this should be captured.
4. For a systemic pattern:
   - Decide whether it belongs in `conventions.md` (general rule) or
     `component-registry.md` (specific element mapping — use the format in
     `registry-format.md`).
   - Draft the rule in 1-2 sentences, consistent in tone/format with existing entries.
   - **Show the proposed addition/edit and ask for confirmation before writing.**
5. If the diff contains multiple distinct corrections, process each separately —
   don't merge unrelated corrections into one vague rule.

The goal is a registry that gets more accurate over time without accumulating noise.
When in doubt whether something is systemic, ask the user rather than guessing.
