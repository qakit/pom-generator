# Component registry entry format

Use this exact format for every entry in `.pom-generator/component-registry.md`,
whether written during Explore or appended during Learn-from-diff. Consistency here
matters more than completeness of any single entry — a generator reads this file to
decide which class to use, so mixed formats reduce match quality.

```md
## <ComponentName>
**File:** `<path/to/Class.ts>`
**When to use:**
  - <DOM signature bullet 1 — role/attribute/structure>
  - <DOM signature bullet 2, if needed>
**Not to be confused with:** <similar component, and the distinguishing feature>
**Methods:** `method1(args)`, `method2(args)`, `method3()`
```

Guidelines:
- DOM signature bullets should be things actually observable in a Playwright
  accessibility snapshot (roles, aria attributes, data-testid, structural nesting) —
  not vague descriptions like "looks like a dropdown".
- Keep "When to use" to 2-4 bullets max. If a component needs more than that to
  identify, it's probably two components pretending to be one — flag it to the user.
- Always fill "Not to be confused with" if any other registry entry is visually or
  structurally similar. This is the single highest-value field for preventing
  misclassification.
- Methods list should be the actual public API of the class, not implementation detail.
