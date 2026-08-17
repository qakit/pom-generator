# Analysis: Employees
<!-- pom-generator/analysis v2 -->

## Meta
**URL:** https://app.example.com/employees
**Slug:** employees
**Analyzed:** 2026-08-17T10:00:00Z
**Viewport:** 1440x900
**Baseline:** ./screens/baseline.png
**Phase:** classified
**Selector-strategy:** data-aid (0.61 coverage, type-level, stable) > authored class stem > role+text

## Delta
**Against:** 2026-08-01T09:14:00Z
**Added:** E-07 (clear icon)
**Removed:** E-09
**Unchanged:** 14 elements

## Regions

### R-01 — Header
**Root:** `[data-aid='layout_header']`
**Resolves:** 1
**Contains:** E-01, E-02, E-09
**Notes:** page-level, not extracted as a component

### R-02 — Filter panel
**Root:** `div[class*='_filterPanel_']`
**Resolves:** 1
**Contains:** E-03, E-04, E-07, E-08, E-15

### R-03 — Employees table
**Root:** `div[class*='_table_']`
**Resolves:** 1
**Contains:** E-10, E-11, E-12

### R-04 — Create employee dialog
**Root:** `[role='dialog']`
**Resolves:** 1
**Component:** C-01
**Open-path:** click E-02 (create employee button)
**Contains:** E-05, E-06, E-16

### R-05 — Role listbox
**Root:** `[role='listbox']`
**Resolves:** 1
**Component:** C-02
**Open-path:** open C-01, then click E-05 (role select trigger)
**Contains:** E-17

## Elements

### E-01 — Archive link
**Region:** R-01
**Scope:** page
**Text:** "Archive"
**Selector:** `a[class*='_archiveLink_']`
**Resolves:** 1
**Kind:** actionable
**Type:** actions/link
**Registry:** NEW
**Probe:** Read href
**Observed:** href="/employees/archive" — navigates to the archive list page
**Locator:** `this.page.locator("a[class*='_archiveLink_']")`
**Status:** probed

### E-02 — Create employee
**Region:** R-01
**Scope:** page
**Text:** "Create employee"
**Selector:** `[data-aid='create-employee-btn']`
**Resolves:** 1
**Kind:** actionable
**Type:** actions/button
**Registry:** NEW
**Probe:** Clicked
**Observed:** modal dialog "Create employee" opened as a portal at document.body; backdrop dims the page behind it
**Reveals:** C-01
**Locator:** `this.page.locator("[data-aid='create-employee-btn']")`
**Status:** probed

### E-03 — Team filter
**Region:** R-02
**Scope:** R-02
**Text:** "All teams"
**Selector:** `[data-aid='team-multiselect']`
**Resolves:** 1
**Kind:** actionable
**Type:** selection/multi-select
**Registry:** TeamSelect
**Locator:** `this.element.locator("[data-aid='team-multiselect']")`
**Status:** recognized

### E-04 — Employee search
**Region:** R-02
**Scope:** R-02
**Text:** "Search employees"
**Selector:** `input[class*='_searchInput_']`
**Resolves:** 1
**Box:** 24,84,320,40
**Kind:** actionable
**Type:** inputs/search
**Registry:** NEW
**Probe:** Typed "Rivera"
**Value-source:** page-data
**Observed:** table filtered live from 84 to 3 rows; a clear icon appeared inside the field; count label updated
**Reveals:** E-07
**Affects:** E-11
**Locator:** `this.element.locator("input[class*='_searchInput_']")`
**Status:** probed

### E-05 — Role select
**Region:** R-04
**Scope:** R-04
**Text:** "Role"
**Selector:** `[data-aid='role-select']`
**Resolves:** 1
**Kind:** actionable
**Type:** selection/single-select
**Registry:** NEW
**Probe:** Selected "Manager"
**Observed:** listbox opened as a portal at document.body with 4 options; on select the Grade field appeared below the role row
**Reveals:** C-02, E-16
**Locator:** `this.element.locator("[data-aid='role-select']")`
**Status:** probed

### E-06 — Cancel button
**Region:** R-04
**Scope:** R-04
**Kind:** actionable
**Type:** actions/button
**Registry:** NEW
**Text:** "Cancel"
**Probe:** Clicked "Cancel"
**Observed:** the create form closed; table unchanged; no request fired
**Locator:** `this.element.locator("button[class*='_cancelBtn_']")`
**Selector:** `button[class*='_cancelBtn_']`
**Resolves:** 1
**Status:** probed

### E-07 — Clear search icon
**Region:** R-02
**Scope:** R-02
**Selector:** `button[class*='_clear_']`
**Resolves:** 1
**Kind:** actionable
**Type:** actions/icon-button
**Registry:** NEW
**Open-path:** type into E-04, then
**Probe:** Clicked
**Observed:** input cleared; table returned to 84 rows; the icon disappeared
**Locator:** `this.element.locator("button[class*='_clear_']")`
**Status:** probed

### E-08 — Filter chip "qa"
**Region:** R-02
**Scope:** R-02
**Text:** "qa"
**Selector:** `[data-aid='active-filter-group']`
**Resolves:** 3
**Kind:** actionable
**Type:** actions/button
**Registry:** NEW
**Class:** filter-chip
**Probe:** Clicked chip "qa"
**Observed:** table filtered to rows tagged "qa"; the chip gained a highlighted border
**Locator:** `this.element.locator("[data-aid='active-filter-group']")`
**Status:** probed

### E-09 — Export button
**Region:** R-01
**Scope:** page
**Selector:** `[data-testid='export']`
**Resolves:** 0
**Kind:** actionable
**Type:** actions/button
**Status:** removed

### E-10 — Employee row
**Region:** R-03
**Scope:** R-03
**Selector:** `div[class*='_row_']`
**Resolves:** 24
**Kind:** container
**Type:** containers/card
**Registry:** TableRow
**Locator:** `this.element.locator("div[class*='_row_']")`
**Status:** recognized

### E-11 — Row count label
**Region:** R-03
**Scope:** R-03
**Text:** "84 employees"
**Selector:** `span[class*='_count_']`
**Resolves:** 1
**Kind:** static
**Type:** other/text-label
**Locator:** `this.element.locator("span[class*='_count_']")`
**Status:** static-confirmed

### E-12 — Name column header
**Region:** R-03
**Scope:** R-03
**Text:** "Name"
**Selector:** `th[class*='_nameHeader_']`
**Resolves:** 1
**Kind:** actionable
**Type:** collections/sortable-header
**Registry:** NEW
**Probe:** Clicked "Name" header twice
**Observed:** rows reordered ascending then descending; aria-sort toggled between ascending and descending
**Locator:** `this.element.locator("th[class*='_nameHeader_']")`
**Status:** probed

### E-15 — Filter chip "design"
**Region:** R-02
**Scope:** R-02
**Text:** "design"
**Selector:** `[data-aid='active-filter-group']`
**Resolves:** 3
**Kind:** actionable
**Type:** actions/button
**Registry:** NEW
**Class:** filter-chip
**Locator:** `this.element.locator("[data-aid='active-filter-group']")`
**Class-ref:** E-08
**Status:** probed-by-class

### E-16 — Grade field
**Region:** R-04
**Scope:** R-04
**Text:** "Grade"
**Selector:** `input[class*='_gradeInput_']`
**Resolves:** 1
**Kind:** actionable
**Type:** inputs/text
**Registry:** NEW
**Open-path:** select a role in E-05, then
**Probe:** Typed "Senior 3"
**Value-source:** label
**Observed:** value accepted; no validation message; nothing else changed on the form
**Locator:** `this.element.locator("input[class*='_gradeInput_']")`
**Status:** probed

### E-17 — Role option
**Region:** R-05
**Scope:** R-05
**Selector:** `[role='option']`
**Resolves:** 4
**Kind:** actionable
**Type:** selection/option
**Registry:** NEW
**Class:** role-option
**Probe:** Selected "Manager" option row
**Observed:** the list closed; trigger text changed to "Manager"; the highlighted row moved
**Locator:** `this.element.locator("[role='option']")`
**Status:** probed

## Component tree

- **EmployeesPage** → `src/pages/EmployeesPage.ts` [NEW] (R-01, page-level)
  - **EmployeeFilterPanel** → `src/components/EmployeeFilterPanel.ts` [NEW] (R-02)
  - **EmployeesTable** → `src/components/EmployeesTable.ts` [REUSE DataTable] (R-03)
  - **CreateEmployeeDialog** → `src/components/CreateEmployeeDialog.ts` [NEW] (C-01, R-04, opened by E-02)
    - **RoleSelectList** → `src/components/RoleSelectList.ts` [REUSE SelectList] (C-02, R-05, opened by E-05)

## Output manifest

| File | Class | Kind | Status |
|---|---|---|---|
| src/pages/EmployeesPage.ts | EmployeesPage | page | planned |
| src/components/EmployeeFilterPanel.ts | EmployeeFilterPanel | component | planned |
| src/components/CreateEmployeeDialog.ts | CreateEmployeeDialog | component | planned |
