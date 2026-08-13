# pom-generator

**AI-generated Playwright Page Objects that actually match your codebase — not generic boilerplate.**

A Claude Code plugin that learns the conventions of your existing Playwright + TypeScript
test framework, then generates new Page Object / element / component wrappers in that
same style — by opening real pages in your app, not by guessing from a URL or a pasted
snapshot. It gets more accurate over time by absorbing your manual corrections back into
its knowledge of your framework.

## The problem this solves

Wrapping a new page in a Page Object Model is repetitive, mechanical work once your
framework's conventions are established — but every AI code-gen tool defaults to
generic patterns (raw CSS selectors, no reuse of your custom component classes, wrong
naming) unless it actually knows your codebase's specific style. Re-explaining your
conventions in every prompt doesn't scale.

`pom-generator` fixes this by treating your framework's conventions as a persistent,
versioned artifact — explored once, refined continuously — rather than something you
re-describe every time you ask for a new wrapper.

## How it works

```
 explore                    generate                      learn
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│ Scans your  │      │ Opens a real page via │      │ You correct the │
│ existing    │ ───► │ Playwright MCP,       │ ───► │ generated file,  │
│ pages/      │      │ matches elements      │      │ the correction   │
│ elements/   │      │ against the learned   │      │ is absorbed back │
│ components/ │      │ registry, writes a    │      │ into the         │
│             │      │ POM in your style      │      │ conventions       │
└─────────────┘      └──────────────────────┘      └─────────────────┘
      │                                                      │
      └──────────────── loop: gets more accurate ─────────────┘
```

1. **Explore** — one-time (or periodic) scan of your existing framework code. Produces
   `conventions.md` (folder structure, naming, locator strategy, base classes) and
   `component-registry.md` (a dictionary mapping DOM patterns to your custom element
   classes — dropdowns, tables, modals, badges, whatever you've built). Runs in three
   checkpointed stages so you review each part before it's finalized.

2. **Generate** — point it at a URL, or a multi-step flow (page → click → modal/page →
   ...). It opens the real page through the Playwright MCP server, reads the
   accessibility snapshot, checks every custom-looking element against your registry,
   and writes a Page Object matching your actual style — reusing existing wrapper
   classes wherever the pattern is already known, flagging genuinely new patterns for
   review instead of guessing.

3. **Learn** — after you correct a generated file by hand, run learn-from-diff. It
   distinguishes a one-off fix from a systemic pattern, and — only with your
   confirmation — writes the pattern back into your conventions so the next generation
   gets it right the first time.

## What's in the box

| Command | Does |
|---|---|
| `/explore [dirs]` | Bootstrap or refresh conventions + component registry from your existing code |
| `/generate <url>` | Generate a Page Object for a single page |
| `/generate-flow <route.yml>` | Generate Page Objects/Components across a multi-step navigation flow |
| `/learn-from-diff [file]` | Analyze your manual edit to a generated file and propose a convention update |

Plus a bundled **Playwright MCP server** (installed automatically with the plugin) so
Claude can actually open and read your app's pages.

## Safety

- Never touches credentials. It expects an already-authenticated browser session
  (`storageState.json`) that you generate yourself with your own login script — the
  plugin never sees your password and never logs in on your behalf.
- Never performs destructive or mutating actions (form submits, delete/confirm clicks,
  etc.) without your explicit, per-instance permission. Navigation, hovering, and
  reading snapshots are all it does on its own.

## Requirements

- [Claude Code](https://claude.com/product/claude-code)
- Node.js + `npx` available on your machine (used to run the bundled Playwright MCP
  server and your own auth script)
- An existing Playwright + TypeScript test framework with at least a few Page Objects
  already written — `/explore` needs real code to learn from

## Install

```
/plugin marketplace add qakit/pom-generator
/plugin install pom-generator@pom-generator
```

Alternatively, cross-harness install via the open `skills.sh` tooling (also works with
non-Claude agents):
```bash
npx skills add qakit/pom-generator
```

Full step-by-step setup (auth session, first explore run, day-to-day usage) is in
[SETUP.md](./SETUP.md).

## License

MIT
