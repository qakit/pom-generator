# `fixture-page.html` — what a correct analysis concludes

Do **not** read this before running `/pom-analyze` against the page. It is the answer key.

Every trap below is one that a real run got wrong. The page exists so the pipeline can be
regressed against them without needing anyone's application.

## Running it

```bash
cd docs && python -m http.server 8000     # or: npx serve .
/pom-analyze http://localhost:8000/fixture-page.html
```

No login, no network, no dependencies. `?v=customers` and `?v=reports` are the same page — the nav
links are real `href`s so the link tier has something honest to read.

---

## The traps

| # | What it looks like | What it actually is | Catches |
|---|---|---|---|
| 1 | `→` button at the end of every row | **Navigation** to `#/orders/<id>`. Not a menu, opens nothing | Recording a row action as a kebab menu |
| 2 | A "Delivery type" select | Choosing `Scheduled` reveals a date field; `Delivery window` reveals a from/to pair. Neither exists until a value is **committed** | Opening a select, pressing Escape, and concluding the field does not exist |
| 3 | An "Add a note" link | Replaces itself with a `<textarea>` | Reading a reveal as a file drop zone or upload |
| 4 | 60 rows, 20 at a time | Infinite scroll. **There is no pagination anywhere** | Inventing pagination controls |
| 5 | `⚙` and `▼` in the header | Icon-only, no text | Skipping controls that carry no text |
| 6 | `⚙` and `▼` side by side, same size and shape | Gear opens a settings dialog; funnel toggles the filter bar. **Unrelated** | Treating look-alikes as one equivalence class |
| 7 | Every `<tr>` carries an `id` | Re-minted on every load, `:r4k7:` style | Selecting on a framework-generated id that survives one snapshot |
| 8 | `main.content-scroll` | Bounding box spans the whole document, not the viewport. An element screenshot of it is tall and mostly blank | Filing an unreadable crop as a region's visual evidence |
| 9 | "Search orders" | Matches only customer names and refs that are **in the table**. A synthetic token returns the empty state | Probing a search box with `zzprobe` and learning nothing |
| 10 | `.cust` inside each row | 60 matches in the document, exactly 1 inside a row | Counting matches page-wide instead of inside the scope |
| 11 | Two dialogs | The gear and "New order" open **different** dialogs with different contents | Recording one control's outcome for another |
| 12 | "Create" button | Disabled until customer **and** delivery type are both set | Recording a disabled control's state as permanent |

---

## Expected artifact, in outline

**`Meta.Selector-strategy`** — `data-testid` should win: high coverage, unique values, and
unchanged across the reload. The per-row `id` attribute should be **rejected** by the reload
comparison (trap 7), and `Resolves` on anything selected by it would be unstable.

**Regions** — roughly: header, side nav, filter bar, orders panel, plus the two dialogs as
revealed regions. The orders panel's `Root` must be the panel, not `main` (trap 8); a `Box` taller
than twice the viewport should trip W008.

**Scopes** — the row is scoped to the table, the customer cell to the row (trap 10). A cell
selector must ground to `Resolves: 1`, not 60.

**Tiers** — the three nav links are `Tier: evidence` (real `href`, no handler). The gear and funnel
are `full` and must **not** share a `Class:` (trap 6). Row `→` buttons are one class with one
member probed in full.

**Probes that must happen**

- `order-delivery` must be **Selected**, not merely clicked (V011). Selecting `Scheduled` must
  append `order-date` to the queue with `Status: pending`; selecting `Delivery window` must append
  the from/to pair. A run that never commits a value will report these as non-existent — which is
  the failure this page exists to reproduce.
- `order-add-note` must be clicked and its revealed `<textarea>` recorded as `inputs/textarea`
  (trap 3).
- `order-search` must be probed with `Value-source: page-data` — a customer name visible in the
  table. `synthetic` should raise W009, and the observation should be the empty state, which is
  not a completed probe.
- `row-open` must be probed and recorded as navigation, with the URL change as the observation.
- `order-submit` starts disabled; that is a state, not a property. Its enabled path requires the
  customer field and the delivery type to be set first.

**Nothing should be recorded as `collections/pagination`** (trap 4). The table's behaviour is
`collections/virtualized-list`-adjacent: scrolling appends rows.

**Two component boundaries** should come out of decomposition: a settings dialog and an order
dialog, each with its own manifest row (V030 → V023 → V050).

---

## What to check afterwards

1. `node plugins/pom-generator/scripts/validate-analysis.mjs --strict .pom-generator/analysis/<slug>` exits 0.
2. Every trap above appears in the artifact with the *right* conclusion.
3. The Gate 1 budget was presented, and the run finished inside it.
4. No element carries `Resolves: 0`, and no element that is not a container or a declared class
   carries `Resolves` above 1.
5. Re-run `/pom-analyze` unchanged and confirm the `## Delta` is empty — nothing added, nothing
   removed. A removal here would be a V061 failure waiting to happen.
