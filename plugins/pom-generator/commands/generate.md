---
description: (alias) Analyze a page and generate its Page Object — runs /pom-analyze then /pom-generate
argument-hint: <url>
---

This is the old single-step command. The pipeline is now split in two, because probing a page and
writing code are different jobs and interleaving them caused elements to be dropped.

Tell the user this, then run the correct command for what they gave you:

- **a URL** → run `/pom-analyze $ARGUMENTS`. It produces a reviewable analysis artifact and
  writes no code. When it finishes, `/pom-generate <slug>` writes the Page Objects.
- **a slug that already has an artifact** under `.pom-generator/analysis/` → run
  `/pom-generate $ARGUMENTS`.

Do not attempt to do both in one pass.
