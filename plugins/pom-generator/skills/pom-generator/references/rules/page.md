# Rules — Page scope

**Invariants** for the top of the tree. Scope: everything reachable at one URL without navigating
away (`01-glossary.md`).

---

## P1. A page composes; it does not own leaves

The Page class holds components. It holds a leaf element only when that element genuinely belongs
to no component, and that must be declared rather than defaulted (`rules/component.md` C10).

A Page with twenty direct getters is not a page object — it is the flattened inventory this whole
process exists to avoid.

## P2. One URL, one artifact, one slug

A page's analysis lives at `.pom-generator/analysis/<slug>/analysis.md`, slug derived per
`01-glossary.md`. A click that navigates elsewhere produces a *different* page with its own slug
and its own artifact. Do not append a second page's elements to the first page's file.

The boundary case: a client-side route change that swaps most of the content. Treat it as a new
page if the URL changed, regardless of whether the browser did a full load.

## P3. Overlays belong to the page that opened them

A dialog is not a page even though it feels like one. It has no URL, it is reached only through
its opener, and it lives in the artifact of the page that revealed it — as a `C-nn` component
(`rules/component.md` C8).

The test: could a user bookmark it and land there directly? If yes it is a page; if no it is a
component.

## P4. Navigation methods follow the project, not a default

How a page's action methods behave when they navigate is already decided by the codebase — read
`conventions.md` Stage 0.4 and follow it:

- return the next Page Object for fluent chaining, or
- return nothing and let the test construct the next page, or
- something else this project does

Do not introduce a chaining style the project does not already use, and do not drop one it does.
If Explore recorded the pattern as *inconsistent*, flag it rather than silently picking a side —
that inconsistency is a finding for the user, not a decision for the generator.

## P5. The page's own identity

Whatever the project uses to identify and reach a page — a `url` property, a `path`, a `goto()`,
a base-URL-relative route — follow the existing pattern exactly. This is one of the most visible
conventions in a POM suite and one of the easiest to get subtly wrong.

Record the URL in `Meta.URL`. If the URL contains identifiers (`/employees/1234/edit`), note in
the artifact which segments are parameters, since the generated page will need to accept them.

## P6. Traversal order is top to bottom, left to right

Survey walks the page the way a person scans it. This is not cosmetic:

- it keeps sibling and dependency relationships discoverable in the order they would be noticed —
  "this dropdown affects the section below it" is obvious in reading order and invisible in DOM
  order;
- it makes the generated file's member order predictable and reviewable;
- it makes a missed area visible as a gap in a sequence rather than an absence nobody can see.

## P7. The page's state at analysis time is a fact about the analysis

A page analyzed while a filter was active, a tab other than the default was selected, or a
particular record was loaded describes *that* state. Record anything relevant in `Meta.Notes`.

Two consequences:

- reset discipline between probes (`rules/element.md` E6) is what keeps the whole artifact
  describing one consistent state;
- an empty collection produces a very different page from a populated one. If the page is empty at
  analysis time, say so — the wrapper will be missing every row-level element, and that is a real
  limitation to surface at the gate rather than a silent gap.

## P8. Viewport is part of the result

Layout-dependent structure — how many cards per row, whether a sidebar is collapsed, whether a
toolbar has overflowed into a kebab menu — depends on the viewport. Set it from `conventions.md`
at preflight, record it in `Meta.Viewport`, and treat a different viewport as a different analysis.

A responsive page that collapses its nav into a hamburger below some width has genuinely different
elements at the two sizes. Analyzing one and generating for both is a wrong wrapper.

## P9. Everything in the survey is accounted for

Nothing in the page is left unassigned. Every element belongs to a region; every region is either
claimed by a component in the tree or explicitly marked page-level (V020, V025, V052).

This is what turns "did we get everything?" from a question of confidence into a question of
arithmetic.
