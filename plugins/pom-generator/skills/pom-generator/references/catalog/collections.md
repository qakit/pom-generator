# Catalog — Collections

Repeated data. The family rule:

> **Never generate one getter per row.** A collection produces exactly two things: a class for the
> collection, and a class for one item. Everything else is indexing. `getRow(2)`, `getRowByName("Ada")`,
> `getRows()` — never `secondRow`, `adaRow`, `row3NameCell`.

The second family rule: **probe one item thoroughly, then verify the others match.** Exhaustively
probing 84 rows is waste; probing zero and assuming is a guess. Probe one, compare the rest
structurally, and record that you did exactly that.

Check `conventions.md` (Stage 0.4, "Usage patterns") before designing the API here — the project
has already decided whether indexing methods return a raw `Locator` or a wrapper instance, and
that decision wins over anything suggested below.

---

## collections/table
**Aliases:** data grid, results table
**Identify:** `role=table`/`<table>`, or a div structure with a header row and repeated data rows in columns
**Not:** `collections/list` (no columns); `collections/grid` (tiles, not rows)
**Required probe:** `Kind: container` — the table itself is usually not clicked. What you must do instead:
  1. record the column headers in order,
  2. probe **one** row's interactive parts (row click, per-row action buttons, inline edit, checkbox),
  3. confirm the remaining rows share that structure,
  4. probe the header separately if any column is sortable (`collections/sortable-header`),
  5. find and record the empty state and the loading state if reachable without mutating data
**Observe:** row count, column headers, whether the whole row is clickable as well as its buttons, per-row actions, selection checkboxes, whether a row click navigates or expands
**Reset:** whatever the row probe changed; reload if a row click navigated
**Reveals:** a row-level action often opens a dialog — that is a `C-nn` like any other
**Wrapper shape:** `getRows()`, `getRow(index)`, `getRowBy(columnValue)`, `getRowCount()`, `getHeaders()`, `isEmpty()`; plus a separate row component with the per-row getters and actions

## collections/grid
**Aliases:** tile view, card grid, gallery
**Identify:** repeated `containers/card` items laid out in columns that reflow with width
**Not:** `collections/table`
**Required probe:** as `collections/table` — one item thoroughly, structure of the rest confirmed
**Observe:** items per row at the recorded viewport (it is layout-dependent, so record the viewport), what is interactive on a tile, hover-revealed actions
**Reset:** per the probed action
**Wrapper shape:** `getItems()`, `getItem(index)`, `getItemBy(title)`, `getItemCount()`; plus the card component

## collections/list
**Aliases:** result list, feed, vertical list
**Identify:** repeated items stacked vertically, no column structure; `role=list`/`ul`
**Not:** `actions/menu` (commands); `selection/single-select` options
**Required probe:** as above
**Observe:** whether items are links, whether they carry per-item actions, grouping headers, dividers
**Reset:** per the probed action
**Wrapper shape:** `getItems()`, `getItem(index)`, `getItemBy(text)`, `getItemCount()`

## collections/tree
**Aliases:** tree view, folder browser, nav tree
**Identify:** nested expandable nodes with indentation; `role=tree`/`treeitem`; expand/collapse chevrons
**Not:** `containers/accordion` (flat, not nested); `collections/list`
**Required probe:** expand one node, confirm children appear, expand a **child** node to confirm the nesting recurses, then select a leaf and observe what it does. Collapse back
**Observe:** lazy loading of children, whether selecting a branch differs from selecting a leaf, multi-level depth, checkbox trees with indeterminate parents
**Reset:** collapse everything you expanded, reload if the tree tracks state
**Reveals:** child nodes; whatever selecting a node loads
**Wrapper shape:** one recursive node component. `getNode(path)`, `expand(path)`, `select(path)`, `getChildren(path)` — path-based, never one getter per node

## collections/pagination
**Aliases:** pager, page controls
**Identify:** page numbers and/or prev/next controls below a collection; sometimes a page-size selector
**Not:** `actions/button` individually — the cluster is one component
**Required probe:** click next, confirm the collection's contents actually changed (compare a value, not just the page number), then return to page one. If a page-size selector exists, that is a `selection/single-select` element inside this component and needs its own probe
**Observe:** total count/pages if displayed, whether the URL carries the page, whether prev is disabled on page one, server-side vs client-side paging
**Reset:** return to page one and confirm the original first row
**Wrapper shape:** `goToPage(n)`, `next()`, `previous()`, `getCurrentPage()`, `getTotalPages()`, `setPageSize(n)`

## collections/sortable-header
**Aliases:** sortable column
**Identify:** a table header that is clickable, usually with a sort arrow; `aria-sort`
**Not:** a plain header (`other/text-label`)
**Required probe:** click once and confirm the **data reordered** — compare the first row's value before and after. Click again for the reverse direction. Two clicks, because ascending and descending are two states and some columns only support one
**Observe:** the direction sequence (asc → desc → none?), whether sorting is server-side, whether it resets pagination
**Reset:** return to the original sort order, or reload
**Wrapper shape:** part of the table component: `sortBy(column)`, `getSortDirection(column)`

## collections/virtualized-list
**Aliases:** windowed list, infinite scroll
**Identify:** only a subset of items exists in the DOM; scrolling swaps the DOM nodes; a large spacer element; total count far exceeds rendered nodes
**Not:** `collections/list` — behaviourally critical to distinguish, because **a locator for an off-screen item will not resolve**, and a wrapper that ignores this produces tests that fail intermittently based on scroll position
**Required probe:** scroll and confirm the DOM nodes are recycled rather than appended. Note the rendered window size
**Observe:** whether it loads more on scroll (infinite) or virtualizes a known total, whether item identity is stable across scroll
**Reset:** scroll back to the top
**Wrapper shape:** must expose scroll-to-item: `scrollToItem(text)` then `getItem(text)`. Document in a `// REVIEW` comment that item getters require the item to be scrolled into view first — this is exactly the kind of constraint that is invisible in a generated file and expensive in a test suite
