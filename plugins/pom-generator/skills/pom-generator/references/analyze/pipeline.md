# Analyze — pipeline

`/pom-analyze <url>` opens a real page, works out what is on it, and writes
`.pom-generator/analysis/<slug>/analysis.md`.

**It writes no Page Object code.** That is `/pom-generate`, and it runs from the artifact alone.
The split is deliberate: interleaving probing and code-writing is what caused elements to be
dropped mid-run.

---

## Phases

| | Phase | Produces | Gate |
|---|---|---|---|
| P0 | Preflight | `## Meta`, an empty skeleton | — |
| P1 | Survey | `## Regions`, `## Elements` all `pending` | **STOP** |
| P2 | Decompose | `## Component tree`, `## Output manifest` | **STOP** |
| P3 | Probe | every element reaches a terminal status | — |
| P4 | Classify | `Registry`, `Locator*`, `## Delta` | — |

Each phase's document: `p1-survey.md`, `p2-decompose.md`, `p3-probe.md`, `p4-classify.md`.
Read the one you are in; do not work from memory of a previous run.

After each phase, run the validator for that phase and advance `Meta.Phase` only when it passes:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=<phase> .pom-generator/analysis/<slug>
```

## The two gates

Both exist because these are the errors that are expensive to undo.

**Gate 1, after survey.** Present the region map, the element inventory as a table, and **the
budget**. The user is checking two things: something *missing* — a toolbar you did not see, a
control in a side panel — and whether P3 is about to spend its time on the right controls. Catching
either here costs one edit; catching it later costs the whole probe run.

The budget is a real number of tool calls, derived from the `Tier:` assigned to each element, and
it goes into `Meta.Budget` once approved. P3 is unattended, so this is the last point at which its
cost is negotiable.

**Gate 2, after decomposition.** Present the component tree. The user is checking *boundaries* — is
that really one filter panel, should the table and its toolbar be separate. A wrong boundary
propagates into every generated file, and unlike a wrong selector nothing downstream catches it.

Probing (P3) runs unattended. It is long, mechanical, and self-checking; the artifact is the review
surface when it finishes — and it stops at 1.5× the approved budget rather than running until
somebody gives up.

Stop means stop: present, and wait for the user's reply. Do not run the next phase in the same
turn.

## Resuming

The artifact is the state of the run, not a report written at the end. It is rewritten after every
element, so an interrupted run — crash, context compaction, the user walking away — loses at most
one element.

To resume, read `Meta.Phase` and continue from there. If `Phase: probed` but elements are still
`pending`, just keep draining the queue; that is the normal resume path and needs no special
handling.

Never restart from P1 on a run that has probe results. Re-probing is expensive and discards
observations that are still valid.

## Re-analysis (delta mode)

If `analysis.md` already exists for this slug, this is a re-analysis. Do not overwrite it.

1. Keep the existing file as the comparison base.
2. Run P1 fresh against the live page.
3. Compare by element **name and DOM signature**, not by ID — IDs are ours, the page's identity is
   what changed or did not.
4. Write `## Delta` (`02-artifact-schema.md`) recording Added / Removed / Changed / Unchanged.
5. **Only `pending` elements get probed.** Unchanged elements keep their existing observations —
   re-probing a control that did not change wastes a run and gains nothing.
6. Removed elements keep their IDs and get `Status: removed`. Never renumber.

Present the delta at Gate 1. A delta of "nothing changed" is a complete and useful result — say so
and stop rather than manufacturing work.

`/pom-generate` then regenerates only the files whose components contain changed elements, and
**never silently overwrites a file that has been hand-edited since it was generated** — see
`generate/emit.md`.

## What ends the run

P4 finishes, the full validator passes, and you report:

- counts: elements probed, static, blocked
- which components reuse registry entries and which are `NEW`
- anything `blocked-*`, with its reason
- any `Locator-agree: no`
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
| A required MCP tool is missing | Record in `Meta.Tools-degraded`, follow the fallback in `03-toolbelt.md`. If a validator rule becomes unsatisfiable, say so at the gate rather than fabricating a value |
| `Meta.Spent` reaches 1.5× `Meta.Budget` | Stop. Write the artifact, report what is probed and what is still `pending`, and let the user choose. A partial artifact with honest statuses is a usable result; an unbounded run that never reaches `/pom-generate` is not |

Nothing in this table is a reason to skip an element silently. Every one of them ends with a
recorded state.
