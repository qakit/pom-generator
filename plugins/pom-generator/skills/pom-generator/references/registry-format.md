# Component registry entry format

Use this exact format for every entry in `.pom-generator/component-registry.md`,
whether written during Explore or appended during Learn-from-diff. Consistency here
matters more than completeness of any single entry — the analyze run's recognition pass
reads this file to decide which class wraps each control, so mixed formats reduce match
quality directly.

```md
## <ComponentName>
**File:** `<path/to/Class.ts>`
**Fingerprint:** `<selector that identifies this component in any page's DOM>`
**When to use:**
  - <DOM signature bullet 1 — role/attribute/structure>
  - <DOM signature bullet 2, if needed>
**Not to be confused with:** <similar component, and the distinguishing feature>
**Methods:** `method1(args)`, `method2(args)`, `method3()`
```

Guidelines:

- **`Fingerprint:` is the load-bearing field for recognition.** It is a real selector —
  checkable with one `querySelectorAll` — that matches this component's root wherever it
  appears: a type-level test attribute (`[data-aid='search-combobox']`), an authored class
  stem (`[class*='_datePicker_']`), or a role+attribute combination
  (`[role='combobox'][aria-haspopup='listbox']`). It identifies the component *type*; it
  does not need to be instance-unique. If two registry entries would match the same node,
  the fingerprints are wrong — tighten one and record the difference under "Not to be
  confused with".
- Additional "When to use" bullets should be things actually observable in the DOM or an
  accessibility snapshot (roles, aria attributes, structural nesting) — not vague
  descriptions like "looks like a dropdown". They settle the cases the fingerprint alone
  cannot.
- Keep "When to use" to 2-4 bullets max. If a component needs more than that to
  identify, it's probably two components pretending to be one — flag it to the user.
- Always fill "Not to be confused with" if any other registry entry is visually or
  structurally similar. This is the single highest-value field for preventing
  misclassification.
- Methods list should be the actual public API of the class, not implementation detail.
