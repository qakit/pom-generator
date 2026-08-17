# Analyze — pipeline

`/pom-analyze <url>` opens a real page, works out what is on it, and writes
`.pom-generator/analysis/<slug>/analysis.md`.

**It writes no Page Object code.** That is `/pom-generate`, and it runs from the artifact alone.

**Recognition comes before probing.** The first question about every control is the one an
experienced SDET asks: *do I already have a wrapper for this?* Most controls on most pages are
instances of components the codebase already wraps — matched by the registry's fingerprints, they
are `recognized` and never probed. Interaction is reserved for the short list of controls whose
behaviour is genuinely unknown. A page should cost tens of tool calls, not hundreds.

---

## Phases

| | Phase | Produces | Gate |
|---|---|---|---|
| P0 | Preflight | `## Meta`, an empty skeleton | — |
| P1 | Inventory | regions, all elements, recognition results, tree, manifest, **the probe list** | **CHECKPOINT** |
| P2 | Probe | every element reaches a terminal status | — |
| P3 | Finalize | final `Locator`s, completed tree, `## Delta` | — |

P1's document: `inventory.md`. P2: `probe.md`. P3: `finalize.md`.
Read the one you are in; do not work from memory of a previous run.

After each phase, run the validator and advance `Meta.Phase` only when it passes:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=<phase> .pom-generator/analysis/<slug>
```

(`--phase=inventory` after P1, `--phase=probed` after P2, full run after P3.)

## The one checkpoint

After inventory, present in one message:

1. the region map — each region, its name, its element count
2. **what was recognized** — a table of element → matched wrapper class, per region
3. **the probe list** — the elements that will actually be interacted with, each with one line of
   why recognition could not answer it
4. anything you were unsure about — boundaries, near-miss registry matches, suspected duplicates
5. the planned output files

Then ask two things, plainly:

- **Is anything missing or misidentified?** A missed control is the one error nothing downstream
  recovers from; a wrong recognition writes the wrong wrapper everywhere it appears.
- **Is the probe list right?** They know which controls matter and which existing wrapper a
  near-miss really is.

**Stop and wait.** One reply here costs seconds and replaces the two separate gates the old
pipeline had. Probing then runs unattended to the end of the run — the artifact is the review
surface when it finishes.

## Resuming

The artifact is the state of the run, not a report written at the end. It is updated after every
element, so an interrupted run — crash, context compaction, the user walking away — loses at most
one element.

To resume, read `Meta.Phase` and continue from there. If `Phase: inventory` (approved) and
elements are still `pending`, just keep draining the probe queue; that is the normal resume path.

**Re-bind by `Selector:`, never by a snapshot handle.** Snapshot handles are minted per session by
the MCP server; after a restart they point at nothing, or at something else. Take a fresh
snapshot, run the grounding pass over the stored selectors, and use the result: what still
resolves is still there.

Never restart from P1 on a run that has probe results. Re-probing discards observations that are
still valid.

## Re-analysis (delta mode)

If `analysis.md` already exists for this slug, this is a re-analysis. Do not overwrite it.

1. Keep the existing file as the comparison base.
2. Run P1 fresh against the live page (the bulk extraction makes this cheap).
3. Compare by **selector and DOM signature**, not by `E-nn` ID and never by snapshot handle.
4. Write `## Delta` (`02-artifact-schema.md`) recording Added / Removed / Changed / Unchanged.
5. **Only `pending` elements get probed.** Unchanged elements keep their existing observations.
6. Removed elements keep their IDs and get `Status: removed`. Never renumber.

**Removal needs evidence, not an impression** (V061). An element may only be marked `removed` when
its `Selector:` was resolved against a fresh load and came back `Resolves: 0`, and the `## Delta`
lists it under `Removed:`. Absence from a snapshot is not absence from the app: a control inside a
collapsed panel, behind a tab, or conditional on another field's value is missing from the
snapshot and present in the page.

Present the delta at the checkpoint. "Nothing changed" is a complete and useful result — say so
and stop rather than manufacturing work.

`/pom-generate` then regenerates only the files whose components contain changed elements, and
**never silently overwrites a file that has been hand-edited since it was generated** — see
`generate/emit.md`.

## What ends the run

P3 finishes, the full validator passes, and you report:

- counts: recognized, probed, static, blocked
- which components reuse registry entries and which are `NEW`
- anything `blocked-*`, with its reason
- the planned output files

Then stop. Suggest `/pom-generate <slug>` as the next step; do not run it.

## If something goes wrong mid-run

| Situation | Do |
|---|---|
| Not logged in | `00-safety.md` Rule 2 — tell the user, wait. Never hunt for credentials |
| An overlay will not dismiss | `browser_navigate` to the page URL. Always available, always correct |
| A control is destructive | Record `Status: blocked-safety`, continue. Do not click it |
| An element cannot be reached at all | `Status: blocked-unreachable` with a note. Continue |
| The page errors or a probe breaks it | Reload, re-verify baseline, and note it. If the page is genuinely broken, stop and tell the user — that is a bug in their app and a finding worth having |
| A required MCP tool is missing | Record in `Meta.Tools-degraded`, follow the fallback in `03-toolbelt.md`. If a validator rule becomes unsatisfiable, say so at the checkpoint rather than fabricating a value |

Nothing in this table is a reason to skip an element silently. Every one of them ends with a
recorded state.
