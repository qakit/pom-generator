# pom-generator

**AI-generated Playwright Page Objects that actually match your codebase — not generic boilerplate.**

A Claude Code plugin that learns the conventions of your existing Playwright test framework, then
generates new Page Object / component / element wrappers in that same style — by opening real
pages in your app and probing every control on them, not by guessing from a URL or a pasted
snapshot. It gets more accurate over time by absorbing your manual corrections.

Language-neutral: TypeScript, JavaScript, Python or any other Playwright binding, detected from
your project rather than assumed.

## The problem this solves

Wrapping a new page in a Page Object Model is repetitive, mechanical work once your framework's
conventions are established — but every AI code-gen tool defaults to generic patterns (raw CSS
selectors, no reuse of your custom component classes, wrong naming) unless it actually knows your
codebase's specific style. Re-explaining your conventions in every prompt doesn't scale.

There's a second, harder problem. An agent looking at a page snapshot will *guess* what things do.
A chevron icon "obviously" expands a section — until you click it and a dialog opens. A text input
"looks like" a plain field — until you type into it and an autocomplete fires. Guessed behaviour
produces wrappers that compile, review well, and are wrong.

`pom-generator` treats your conventions as a persistent, versioned artifact, and treats page
analysis as something that must be *observed and recorded*, not inferred.

## How it works

```
  /pom-explore              /pom-analyze                    /pom-generate
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│ Scans your   │      │ Opens the real page,  │      │ Reads the artifact,  │
│ existing     │ ───► │ probes every control, │ ───► │ writes Page Objects, │
│ pages /      │      │ records what actually │      │ then verifies every  │
│ elements /   │      │ happened in a strict, │      │ selector against the │
│ components   │      │ validated artifact    │      │ live page            │
└──────────────┘      └──────────────────────┘      └──────────────────────┘
       │                          │                            │
   conventions.md          analysis.md  ──── validator ────────┘
   component-registry.md                     exit 1 = no code is generated
                                  ▲                            │
                                  └──── /pom-learn ◄───────────┘
                                        your correction becomes a convention
```

> **[Visual file map](docs/pipeline-map.html)** — every phase, which plugin files it reads, and what
> it writes. Open it in a browser; print to PDF if you want a copy.

**1. Explore** — a one-time (or periodic) scan of your framework code. Produces `conventions.md`
(folder structure, naming, locator strategy, base classes, and how your tests actually consume the
framework) and `component-registry.md` (a dictionary mapping DOM patterns to your custom wrapper
classes). Seven checkpointed sub-stages, so you review each part before it's finalised.

**2. Analyze** — opens a real page and works out what's on it. Screenshots it, partitions it into
regions visually, enumerates every element, then **probes each one** — types into inputs, selects
from dropdowns, toggles checkboxes, clicks buttons — and records what actually happened. Anything
a probe reveals (a dialog, an autocomplete list, a clear button that only exists once you've typed)
joins the queue and gets probed too. Output is `analysis.md`: a strict, machine-validated record.
**No code is written in this step.**

**3. Generate** — reads the artifact and writes the Page Objects, reusing your existing wrapper
classes where the registry matched and flagging genuinely new patterns for review. Then it opens
the page again and highlights every generated selector to confirm it resolves to the element you
meant.

**4. Learn** — after you correct a generated file by hand, `/pom-learn` works out whether it was a
one-off fix or a systemic pattern, and — only with your confirmation — writes the pattern back into
your conventions.

## Why the analysis is a separate, validated step

The artifact is the contract between analysis and generation, and a bundled validator enforces it:

```
node validate-analysis.mjs .pom-generator/analysis/employees/
```

It rejects, among other things:

- any element left unprobed
- an actionable element whose recorded probe is "Observed" rather than a real action
- a dialog that was opened but never turned into a component file
- a locator inside a component that reaches up to the page
- a region that no component in the tree accounts for

`/pom-generate` runs it first and **writes nothing on a non-zero exit**. This is the difference
between "the instructions said to check everything" and "the run cannot proceed until it has."

Artifacts are committed alongside your tests, so they're reviewable in a PR, they survive a long
session, and re-analysing a page later produces a precise diff — only what changed gets
regenerated, and a file you've hand-edited is never silently overwritten.

## What's in the box

| Command | Does |
|---|---|
| `/pom-explore [dirs]` | Bootstrap or refresh conventions + component registry from your existing code |
| `/pom-analyze <url>` | Analyze one page into a validated artifact (no code) |
| `/pom-analyze-flow <route.yml>` | Analyze a multi-step flow — one artifact per page, shared components wrapped once |
| `/pom-generate <slug>` | Write Page Objects from an artifact, then verify them against the live page |
| `/pom-learn [file]` | Turn your manual correction into a convention |

Plus a bundled **Playwright MCP server**, installed automatically with the plugin.

The old names `/explore`, `/generate`, `/generate-flow` and `/learn-from-diff` still work and
redirect to the new commands.

## Safety

- **Never touches credentials.** Not files, not config, not `.env`, not browser storage or cookies
  — for any reason, including working out whether you're logged in. Login state is read only from
  the rendered page.
- **Never logs in for you.** The bundled MCP server runs headed with a persistent browser profile:
  you log in once, manually, in the visible window, and it's remembered for future runs. If a page
  isn't logged in, the plugin tells you and waits. (A portable/CI session file is available as an
  opt-in alternative — see `references/team-auth-mode.md`. It is not the default, and even then the
  plugin only ever needs the file's *path*.)
- **Never performs destructive or mutating actions** — form submits, Delete/Confirm/Send/Pay
  clicks — without your explicit permission for that specific control. Navigating, snapshotting,
  hovering, opening a dialog to look inside it, and typing a synthetic probe value it then clears
  are all fine on its own.

## Requirements

- [Claude Code](https://claude.com/product/claude-code)
- Node.js — used for the bundled Playwright MCP server and the artifact validator. The validator
  has zero dependencies; nothing to install
- An existing Playwright test framework with at least a few Page Objects already written —
  `/pom-explore` needs real code to learn from

## Install

```
/plugin marketplace add qakit/pom-generator
/plugin install pom-generator@qakit
```

Alternatively, cross-harness install via the open `skills.sh` tooling (also works with non-Claude
agents):

```bash
npx skills add qakit/pom-generator
```

## Getting started

```
/pom-explore                                  # once per repo — review each checkpoint
/pom-analyze https://your-app/some-page       # review at the two gates, then let it probe
/pom-generate some-page                       # writes and verifies the Page Objects
```

The first `/pom-analyze` will open a browser window. If your app isn't logged in there, log in
manually when asked — it's remembered from then on.

## License

MIT
