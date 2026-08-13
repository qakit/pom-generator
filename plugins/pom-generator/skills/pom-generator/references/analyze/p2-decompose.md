# P2 — Decompose

**Goal:** decide which classes will exist and what each one owns.
**Produces:** `## Component tree`, `## Output manifest`.
**Ends at:** Gate 2.

Still no probing, still no code. This phase turns a flat list of regions and elements into a
structure. It is the highest-leverage judgement in the run — see `rules/component.md`.

---

## Steps

### 1. Read the inputs

- `.pom-generator/conventions.md` — folder layout, naming, base classes, and especially the
  Stage 0.4 usage patterns (do indexing methods return wrappers or raw locators? do navigation
  methods chain?). **These decisions are already made and they win** over any default here.
- `.pom-generator/component-registry.md` — what already exists.
- `rules/component.md` — the boundary invariants.

### 2. Test each region for componenthood

For every region from P1, apply the tests in order:

1. **Can you name what it is in one or two words?** (C2) Filter panel, toolbar, results table,
   user card. If yes, it is a component.
2. **Is there a grouping signal?** (C3) `data-testid`, a `role`, a shared CSS-module class stem,
   or consistent structural position. A hashed class with a readable stem counts — do not wait for
   a semantic attribute.
3. **Is it repeated?** (C7) Then it is one class plus indexing, never N getters.
4. **Is it a pure layout wrapper with no name and no identity?** (C9) Then it is not a component —
   address its children from the nearest named ancestor.

A region may split into two components, two regions may merge into one, and a region may dissolve
into the page. Regions were a survey-time device; they have done their job now.

### 3. Check the registry before naming anything new

For every candidate component, and for every element type within it, search
`component-registry.md` — including **container-level** entries, which are the ones most often
missed (C5).

- match → `[REUSE <Class>]` in the tree, `Registry: <Class>` on the elements, no new file
- new → `[NEW]`, `Registry: NEW`
- close but different → `[NEW]` plus a `Notes:` line saying what it resembles and how it differs

Do not create a second wrapper for something already wrapped. Warning W005 catches the obvious
cases; the registry read catches the rest.

### 4. Build the tree

Nesting mirrors the real UI (C4). A dialog's filter panel sits inside the dialog, not on the page.

```md
## Component tree
- **EmployeesPage** → `src/pages/EmployeesPage.ts` [NEW] (R-01, page-level)
  - **EmployeeFilterPanel** → `src/components/EmployeeFilterPanel.ts` [NEW] (R-02)
  - **EmployeesTable** → `src/components/EmployeesTable.ts` [REUSE DataTable] (R-03)
```

Paths and class names come from `conventions.md` — its folder structure and its naming rules, not
a generic guess.

**The parenthetical carries the IDs this entry covers**: its region(s), its `C-nn` if it was
revealed during probing, and any free note such as `opened by E-07`. The validator uses these to
confirm every region is accounted for (V052) and every revealed component reaches a file
(V023 → V050).

At this point the tree only covers what P1 saw. Dialogs and panels that P3 reveals get added to it
as they are discovered — the tree grows during probing, and V030/V023/V050 make sure it does.

### 5. Write the output manifest

One row per file to be created. `[REUSE]` entries get `skipped-reuse`, everything else `planned`.

```md
| File | Class | Kind | Status |
|---|---|---|---|
| src/pages/EmployeesPage.ts | EmployeesPage | page | planned |
| src/components/EmployeeFilterPanel.ts | EmployeeFilterPanel | component | planned |
```

Check the paths against the real repo. A path that does not match the project's actual folder
structure is a `conventions.md` misreading, and it is much cheaper to catch here than after four
files land in the wrong directory.

### 6. Validate

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-analysis.mjs" --phase=decomposed .pom-generator/analysis/<slug>
```

Then set `Meta.Phase: decomposed`.

---

## Gate 2

Present the tree — the structure itself, not a description of it — and for each entry say **why**
it is a component: which test it passed, which grouping signal you used, and whether it reuses
something from the registry.

Call out explicitly:

- anything you were unsure about splitting or merging
- anything marked `NEW` that resembles an existing registry entry
- any region that dissolved into the page, and why
- how many files this will produce

The user is checking boundaries. The useful question to ask them is not "does this look right" but
**"is that really one panel?"** and **"should any of these be shared with another page?"** — they
know the app's structure and its other pages, and you do not.

**Stop and wait.** Probing is long and unattended; it should not start on a structure the user has
not seen.
