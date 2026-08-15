# Analysis: Employees
<!-- pom-generator/analysis v1 -->

This fixture is the validator's reference document. It must validate clean at every phase.
`--self-test` mutates it one rule at a time and asserts that the matching rule fires.

The `./screens/` files referenced below are **not committed**. Rule V015 checks that an
artifact's screenshots exist on disk, so `--self-test` copies this file to a temp directory and
creates the referenced files there before validating. Run the self-test rather than pointing the
validator at this directory directly, which would report V015 failures.

## Meta
**URL:** https://app.example.test/employees
**Slug:** employees
**Analyzed:** 2026-08-13T10:00:00Z
**Viewport:** 1440x900
**Baseline:** ./screens/baseline.png
**Phase:** classified
**Budget:** 60 tool calls
**Spent:** 54

## Regions
### R-01 — Page header
**Root:** `header[class*='_pageHeader_']`
**Shot:** ./screens/R-01.png
**Contains:** E-01, E-09
**Notes:** page-level, no component extracted

### R-02 — Filter panel
**Root:** `div[class*='_filterPanel_']`
**Shot:** ./screens/R-02.png
**Contains:** E-02, E-03

### R-03 — Employees table
**Root:** `div[data-aid='employees-table']`
**Shot:** ./screens/R-03.png
**Contains:** E-04

### R-04 — Create employee dialog
**Root:** `div[role='dialog']`
**Shot:** ./screens/R-04.png
**Contains:** E-05, E-07
**Component:** C-01

### R-05 — Status option list
**Root:** `ul[role='listbox']`
**Shot:** ./screens/R-05.png
**Contains:** E-06, E-08
**Component:** C-02

## Elements
### E-01 — Page title
**Region:** R-01
**Visual:** large bold heading reading "Employees", top left of the content area
**Snapshot-ref:** e11
**DOM:** `h1[class*='_title_']` role=heading level=1
**Kind:** static
**Type:** other/text-label
**Registry:** NEW
**Locator:** `this.page.getByRole("heading", { level: 1 })`
**Locator-pw:** `getByRole('heading', { name: 'Employees' })`
**Locator-agree:** yes
**Status:** static-confirmed

### E-02 — Status filter
**Region:** R-02
**Visual:** pill-shaped control with a grey border and a chevron on the right, reads "All statuses"
**Snapshot-ref:** e47
**DOM:** `div[class*='_select_']` role=combobox aria-haspopup=listbox
**Kind:** actionable
**Type:** selection/single-select
**Tier:** full
**Probe:** Selected "Active"
**Shots:** ./screens/E-02-before.png, ./screens/E-02-after.png
**Observed:** listbox opened with 4 options; GET /api/employees?status=active fired; table went 84 -> 31 rows
**Reveals:** C-02
**Affects:** E-04
**Reset:** re-selected "All statuses", confirmed 84 rows
**Registry:** NEW
**Locator:** `this.element.locator("[data-aid='status-filter']")`
**Locator-pw:** `getByRole('combobox', { name: 'Status' })`
**Locator-agree:** yes
**Status:** probed

### E-03 — Create employee
**Region:** R-02
**Visual:** solid blue button, white text, right-aligned in the filter bar
**Snapshot-ref:** e52
**DOM:** `button[data-aid='create']` role=button
**Kind:** actionable
**Type:** actions/button
**Tier:** full
**Probe:** Clicked
**Shots:** ./screens/E-03-before.png, ./screens/E-03-after.png
**Observed:** a modal opened titled "Create employee" containing 3 fields and Save/Cancel controls
**Reveals:** C-01
**Affects:** E-04
**Reset:** pressed Escape, then reloaded the page URL and confirmed 84 rows
**Registry:** NEW
**Locator:** `this.element.locator("[data-aid='create']")`
**Locator-pw:** `getByRole('button', { name: 'Create employee' })`
**Locator-agree:** no — project convention is data-aid first
**Status:** probed

### E-04 — Employees table
**Region:** R-03
**Visual:** full-width table, 6 columns, zebra striping, 84 rows before filtering
**Snapshot-ref:** e60
**DOM:** `div[data-aid='employees-table']` role=table
**Kind:** container
**Type:** collections/table
**Registry:** DataTable
**Locator:** `this.page.locator("[data-aid='employees-table']")`
**Locator-pw:** `getByRole('table')`
**Locator-agree:** yes
**Status:** probed

### E-05 — Full name field
**Region:** R-04
**Visual:** single-line bordered text box under a "Full name" label, first field in the dialog
**Snapshot-ref:** e71
**DOM:** `input[data-aid='full-name']` type=text
**Kind:** actionable
**Type:** inputs/text
**Tier:** full
**Probe:** Typed "zzprobe"
**Shots:** ./screens/E-05-before.png, ./screens/E-05-after.png
**Observed:** value accepted; a clear X icon appeared inside the field; no network request fired
**Reveals:** E-07
**Reset:** cleared the field via the X icon and confirmed it was empty
**Registry:** NEW
**Locator:** `this.element.locator("[data-aid='full-name']")`
**Locator-pw:** `getByLabel('Full name')`
**Locator-agree:** yes
**Status:** probed

### E-06 — Active option
**Region:** R-05
**Visual:** second row of the opened option list, hover highlight, no checkmark
**Snapshot-ref:** e49
**DOM:** `li[role='option']` aria-selected=false
**Kind:** actionable
**Type:** selection/option
**Tier:** class
**Class:** status-option
**Probe:** Clicked
**Shots:** ./screens/E-06-before.png, ./screens/E-06-after.png
**Observed:** row highlighted, overlay closed, filter chip now reads "Active", 31 rows remained
**Affects:** E-04
**Reset:** reopened the control and re-selected "All statuses"
**Registry:** NEW
**Locator:** `this.element.getByRole("option")`
**Locator-pw:** `getByRole('option', { name: 'Active' })`
**Locator-agree:** yes
**Status:** probed

### E-07 — Clear full name
**Region:** R-04
**Visual:** small grey X icon inside the right edge of the name field, only present once text is entered
**Snapshot-ref:** e73
**DOM:** `button[class*='_clear_']` role=button aria-label="Clear"
**Kind:** actionable
**Type:** actions/icon-button
**Tier:** full
**Probe:** Clicked
**Shots:** ./screens/E-07-before.png, ./screens/E-07-after.png
**Observed:** field cleared to empty, the X icon disappeared, focus stayed in the name field
**Reset:** none needed; the click itself restores the empty baseline
**Registry:** NEW
**Locator:** `this.element.getByRole("button", { name: "Clear" })`
**Locator-pw:** `getByRole('button', { name: 'Clear' })`
**Locator-agree:** yes
**Status:** probed

### E-08 — Suspended option
**Region:** R-05
**Visual:** third row of the same option list, identical shape and padding to the Active row
**Snapshot-ref:** e50
**DOM:** `li[role='option']` aria-selected=false
**Kind:** actionable
**Type:** selection/option
**Tier:** class
**Class:** status-option
**Class-ref:** E-06
**Notes:** same `li[role='option']` under the same listbox, same handler; E-06 was probed in full
**Registry:** NEW
**Locator:** `this.element.getByRole("option")`
**Locator-pw:** `getByRole('option', { name: 'Suspended' })`
**Locator-agree:** yes
**Status:** probed-by-class

### E-09 — Back to dashboard
**Region:** R-01
**Visual:** small text link with a left chevron, above the page title
**Snapshot-ref:** e09
**DOM:** `a[href='/dashboard']` role=link
**Kind:** actionable
**Type:** actions/link
**Tier:** evidence
**Probe:** Read href="/dashboard", target absent, no click handler bound
**Observed:** plain in-app anchor to /dashboard in the same tab; no interception, so following it is a full route change to a page with its own analysis slug
**Registry:** NEW
**Locator:** `this.page.locator("a[href='/dashboard']")`
**Locator-pw:** `getByRole('link', { name: 'Back to dashboard' })`
**Locator-agree:** yes
**Status:** probed

## Component tree
- **EmployeesPage** → `src/pages/EmployeesPage.ts` [NEW] (R-01, page-level)
  - **EmployeeFilterPanel** → `src/components/EmployeeFilterPanel.ts` [NEW] (R-02)
  - **EmployeesTable** → `src/components/EmployeesTable.ts` [REUSE DataTable] (R-03)
  - **StatusOptionList** → `src/components/StatusOptionList.ts` [NEW] (C-02, R-05)
  - **CreateEmployeeDialog** → `src/components/CreateEmployeeDialog.ts` [NEW] (C-01, R-04, opened by E-03)

## Output manifest
| File | Class | Kind | Status |
|---|---|---|---|
| src/pages/EmployeesPage.ts | EmployeesPage | page | planned |
| src/components/EmployeeFilterPanel.ts | EmployeeFilterPanel | component | planned |
| src/components/StatusOptionList.ts | StatusOptionList | component | planned |
| src/components/CreateEmployeeDialog.ts | CreateEmployeeDialog | component | planned |
