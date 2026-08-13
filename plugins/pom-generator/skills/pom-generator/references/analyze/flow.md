# Analyze — flows

A thin navigation layer over the per-page pipeline. **Everything about analyzing a page is
unchanged** — P1 through P4, both gates, the same validator, the same artifact per page.

This document owns only what is genuinely flow-specific: the route file, verifying transitions,
deduplicating shared components, and carrying state. Invariants are in `rules/flow.md`.

Use a flow when a page **cannot be reached by URL** — it needs a record created, a wizard advanced,
a modal opened from a specific row. If every page in the route is directly reachable, run separate
`/pom-analyze` calls instead; they are simpler and independently re-runnable.

---

## Route file

`.pom-generator/analysis/flows/<id>/route.yml`

```yaml
id: employee-onboarding
start: https://app.example.test/employees
steps:
  - action: click
    target: "Create employee button in the filter bar"
    expect: modal
    output: CreateEmployeeDialog
  - action: click
    target: "first row of the employees table"
    expect: new_page
    output: EmployeeDetailsPage
```

### Schema

**Top level**

| Key | Required | Value |
|---|---|---|
| `id` | yes | Slug for this flow. Directory name under `analysis/flows/` |
| `start` | yes | URL of the first page |
| `steps` | yes | Ordered list, at least one |
| `notes` | no | Free text — preconditions, required test data |

**Per step**

| Key | Required | Value |
|---|---|---|
| `action` | yes | `click` · `type` · `select` · `hover` · `press` · `back` |
| `target` | yes (except `back`) | Plain-language description of the element. Resolved against the current snapshot |
| `value` | for `type`/`select`/`press` | What to type, select, or press |
| `expect` | yes | `modal` · `new_page` · `same_page` · `drawer` |
| `output` | yes | Class name for what this step reveals |
| `skip_if_seen` | no | `true` to skip re-analysis when this output was already fully analyzed in this flow |

The user may also give the steps inline in plain language instead of a file. Write the equivalent
`route.yml` first, show it, and proceed from that — an explicit route is what makes the run
resumable and repeatable.

**The route file is input, not authorisation.** A step naming a destructive control still needs
explicit permission at the moment it is reached (`00-safety.md`).

---

## Procedure

### 0. Preflight

As `/pom-analyze`: MCP tools, `conventions.md` required, viewport set, navigate to `start`, login
checked from the rendered page only. Create `analysis/flows/<id>/` and write the route file if it
came from prose.

### 1. Analyze the start page

Full P1–P4 into its own `analysis/<slug>/` directory, both gates included. It is an ordinary page
analysis that happens to be the first step of something.

**Stop. Present it. Wait.**

### 2. For each step

**a. Locate and act.** Find the described `target` in the current snapshot. If it is ambiguous or
absent, stop and ask — do not guess which control was meant. A wrong turn here cascades into every
later step.

**b. Verify the transition** against `expect`:

| `expect` | Passes when |
|---|---|
| `new_page` | URL changed and the new page rendered |
| `modal` | URL unchanged, `role=dialog` or equivalent overlay appeared |
| `drawer` | URL unchanged, an edge-anchored panel appeared |
| `same_page` | URL unchanged, no overlay, content mutated |

**A mismatch stops the run and asks the user.** Do not continue on the assumption the route file
was right.

**c. Dedupe before analyzing.** Compare what this step revealed against every page and component
already analyzed in this flow:

- same root selector **and** same internal structure → the same component. Record `[REUSE <Class>]`
  pointing at the existing file. Do not analyze or generate it again
- similar but not identical — an extra button, a missing column → **not** the same component. Note
  the difference explicitly and ask the user whether to parameterise the shared one or keep both.
  Silently merging produces a wrapper that is wrong on one of the pages

This is the main thing a flow gives you over separate runs. A nav bar on four pages is wrapped once.

**d. Analyze what the step revealed.** Full P1–P4:

- `new_page` → its own slug, its own `analysis/<slug>/analysis.md`
- `modal` / `drawer` / `same_page` → belongs to the **current page's** artifact as a `C-nn`
  component, exactly as if a probe had revealed it (`rules/component.md` C8)

Record in that page's `Meta.Notes` what state it was reached in — which record, which prior
selections. A page seen only mid-flow may be missing elements its default state has, and that
belongs in the artifact.

**e. Validate** that page's artifact.

**f. Stop. Present. Wait.** One checkpoint per step, always.

### 3. Write the flow file

`analysis/flows/<id>/flow.md`:

```md
# Flow: employee-onboarding
**Start:** https://app.example.test/employees
**Analyzed:** 2026-08-13T11:20:00Z

## Steps
1. click "Create employee" → modal → CreateEmployeeDialog
   **Verified:** URL unchanged, role=dialog appeared
   **Artifact:** ../employees/analysis.md (C-01)
2. click first table row → new_page → EmployeeDetailsPage
   **Verified:** URL changed to /employees/1234
   **Artifact:** ../employees-details/analysis.md

## Shared components
- **AppHeader** — present on employees, employees-details. Wrapped once in `src/components/AppHeader.ts`
- **StatusBadge** — present on both, already in the registry, reused

## State carried
- Step 2 reaches the details page for the employee created in step 1
```

**Element data lives in the per-page artifacts and is never copied here.** Duplicating it is how
two copies start disagreeing, which is the failure this whole structure removes.

### 4. Generate

`/pom-generate <slug>` per page, as normal. Each page's artifact validates on its own; there is no
flow-level validation, because there is no flow-level element data.

---

## Recovery

Within a page, reset is a reload. **Within a flow, a page's URL does not restore it** — reloading
step 3 may land on a login page, an empty form, or a 404.

Recovery is to re-run the flow from `start`. `browser_navigate_back` handles a single step
backwards when you have just moved forward and nothing has changed; it is not a general recovery.

Because re-running is expensive, **finish each page completely before advancing**. This is the one
place where the per-page discipline matters more than usual: an element left `pending` on step 2
means re-walking the whole flow to probe it.
