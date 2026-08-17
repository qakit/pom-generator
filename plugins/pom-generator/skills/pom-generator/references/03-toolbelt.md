# Playwright MCP toolbelt

Which tool to reach for, with the parameters that matter — and the three bulk scripts the
pipeline runs instead of per-element calls. Read once at preflight.

Everything here is subject to `00-safety.md`, which lists the tools that are never used at all.

---

## Preflight capability probe

Tool availability varies with the installed `@playwright/mcp` version. At P0, check which of these
exist and record any that don't in `Meta.Tools-degraded`:

| Tool | If missing, fall back to |
|---|---|
| `browser_evaluate` | The pipeline's bulk scripts need it. Without it, fall back to `browser_snapshot` reading and say at the checkpoint that the artifact is ungrounded — that is a real reduction in what the run can promise |
| `browser_take_screenshot` with element targeting | Full-page screenshots only |
| `browser_highlight` | Skip visual spot-checks; verify with `browser_verify_element_visible` alone |
| `browser_find` | Manual re-read of the snapshot for completeness cross-checks |
| `browser_wait_for` | Re-run the diff script once more after a short interaction pause |

A missing tool degrades the run; it never silently skips a step. If a degradation would make a
validator rule unsatisfiable, say so at the checkpoint and let the user decide, rather than
fabricating a value.

---

## The three bulk scripts

These are the pipeline's workhorses. Each is one `browser_evaluate` call that answers a question
about the whole page at once. Adjust selectors and hook lists to what the app actually uses — they
are references, not incantations.

### 1. Selector-strategy probe — "what can this app be located by?"

Run at the start of inventory, **twice, with a reload between** (`04-selectors.md` S1).

```js
// browser_evaluate
(() => {
  const nodes = [...document.querySelectorAll(
    'a,button,input,select,textarea,[role],[tabindex],[onclick],[contenteditable]')];
  const candidates = ['data-testid','data-test','data-qa','data-cy','data-aid','data-automation-id',
                      'id','name','aria-label'];
  const out = { interactive: nodes.length, attributes: {} };
  for (const attr of candidates) {
    const vals = nodes.map(n => n.getAttribute(attr)).filter(Boolean);
    if (!vals.length) continue;
    out.attributes[attr] = {
      coverage: +(vals.length / nodes.length).toFixed(2),
      unique: +(new Set(vals).size / vals.length).toFixed(2),   // low = type-level hook
      sample: vals.slice(0, 5),
    };
  }
  // class stems: the authored part of a CSS-module name, hash removed
  const stems = {};
  for (const n of nodes) {
    for (const c of (n.className || '').toString().split(/\s+/)) {
      const m = c.match(/^(_[A-Za-z][A-Za-z0-9]*_)[A-Za-z0-9_-]{4,8}$/);
      if (m) stems[m[1]] = (stems[m[1]] || 0) + 1;
    }
  }
  out.classStems = Object.keys(stems).length;
  return out;
})()
```

Any attribute whose sampled values changed between the two runs is framework-generated and
unusable. A high-coverage attribute with a **low `unique` score is a type-level hook** — real,
stable, and identifying the component kind rather than the instance; instance identity then comes
from scope + text, and that is what goes into `Meta.Selector-strategy`.

### 2. Inventory extraction — "what is on this page?"

Run once at inventory (and once inside a newly revealed dialog if it is large). Replaces
per-element screenshot/inspect/snapshot calls.

```js
// browser_evaluate
(() => {
  const HOOKS = ['data-testid','data-test','data-qa','data-cy','data-aid','data-automation-id'];
  const hook = n => { for (const h of HOOKS) { const v = n.getAttribute?.(h); if (v) return `${h}=${v}`; } return ''; };
  const stem = n => [...(n.classList || [])]
    .map(c => (c.match(/^(_[A-Za-z][A-Za-z0-9]*_)/) || [])[1]).find(Boolean) || '';
  const vis = n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = n => (
    n.labels?.[0]?.textContent
    || n.getAttribute('aria-label')
    || n.getAttribute('placeholder')
    || document.getElementById(n.getAttribute('aria-labelledby') || '')?.textContent
    || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return [...document.querySelectorAll(
    'a,button,input,select,textarea,[role],[tabindex],[onclick],[contenteditable]')]
    .filter(vis)
    .map(n => {
      const r = n.getBoundingClientRect();
      const chain = [];
      for (let p = n.parentElement; p && p !== document.body && chain.length < 4; p = p.parentElement) {
        const key = hook(p) || stem(p);
        if (key && key !== chain[chain.length - 1]) chain.push(key);
      }
      return {
        tag: n.tagName.toLowerCase(),
        type: n.getAttribute('type') || '',
        role: n.getAttribute('role') || '',
        hook: hook(n),
        stem: stem(n),
        text: (n.innerText || n.value || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        label: label(n),
        href: n.getAttribute('href') || undefined,
        disabled: (n.disabled || n.getAttribute('aria-disabled') === 'true') || undefined,
        cursor: getComputedStyle(n).cursor,
        box: [r.x + scrollX, r.y + scrollY, r.width, r.height].map(Math.round),
        chain,          // nearest hooked/stemmed ancestors, innermost first — region & scope hints
      };
    });
})()
```

`chain` is what maps elements to regions and scopes; `hook`+`stem` are the selector raw material;
`label`/`text` are the human identity; `cursor`/`role` settle "is this div actually a button".

### 3. Scoped diff with portal layer — "what did that action change?"

Run **before and after** every probe action; compare the two results.

```js
// browser_evaluate — SCOPE_SELECTOR is the probed element's Scope: root, or 'body' for page scope
(() => {
  const SCOPE_SELECTOR = 'body';   // ← substitute per element
  const sig = n => [n.tagName, n.getAttribute('role') || '',
    n.getAttribute('data-aid') || n.id || '',                      // ← the app's measured hook
    (n.className || '').toString().slice(0, 40),
    (n.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)].join('|');
  const scope = document.querySelector(SCOPE_SELECTOR) || document.body;
  return {
    inScope: [...scope.querySelectorAll(
      'input,select,textarea,button,a,[role],[tabindex],[contenteditable]')].map(sig),
    // The portal layer: frameworks (React Aria, Radix, MUI…) render dialogs, menus, listboxes
    // and calendars as late children of <body>, OUTSIDE every component subtree. A diff bounded
    // to the trigger's scope alone concludes the select "did nothing".
    portals: [...document.body.children].slice(-10)
      .filter(n => !/^(SCRIPT|STYLE|LINK)$/.test(n.tagName))
      .map(n => ({
        sig: sig(n),
        role: n.getAttribute('role')
          || n.querySelector('[role=dialog],[role=alertdialog],[role=listbox],[role=menu]')
              ?.getAttribute('role') || '',
        text: (n.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      })),
    counts: {   // cheap page-level signals for Affects:
      rows: document.querySelectorAll('tr, [role=row]').length,
    },
  };
})()
```

Anything in the "after" that was not in the "before" **came into existence because of this
probe** — new `inScope` entries are revealed elements; new `portals` entries are revealed
containers. Anything that vanished is recorded too. Changes in `counts` (extend it with whatever
this page's collections are) go to `Affects:`.

### The grounding pass — every selector, one call

Run at the end of inventory and again at finalize. **Selectors are resolved inside their
`Scope:`, not against the document** — a cell selector asked of the document returns one match
per row, asked of a row returns one, and the second number is the one the wrapper will see.

```js
// browser_evaluate
(() => {
  // chain = the Root/Selector of each ancestor, outermost first
  const ids = {
    "R-02": { chain: [], sel: "div[class*='_filterPanel_']" },
    "E-04": { chain: ["div[class*='_filterPanel_']"], sel: "input[class*='_searchInput_']" },
    "E-11": { chain: ["div[class*='_table_']", "div[class*='_row_']"], sel: "[class*='_nameCell_']" },
  };
  const out = {};
  for (const [id, { chain, sel }] of Object.entries(ids)) {
    let root = document;
    try {
      for (const step of chain) {           // first match at every level, like .first() at runtime
        root = root.querySelector(step);
        if (!root) break;
      }
    } catch { out[id] = { error: 'invalid scope selector' }; continue; }
    if (!root) { out[id] = { resolves: 0, note: 'scope did not resolve' }; continue; }
    let nodes = [];
    try { nodes = [...root.querySelectorAll(sel)]; }
    catch { out[id] = { error: 'invalid selector' }; continue; }
    const r = nodes[0]?.getBoundingClientRect();
    out[id] = {
      resolves: nodes.length,
      box: r ? [r.x + scrollX, r.y + scrollY, r.width, r.height].map(Math.round).join(',') : null,
    };
  }
  return out;
})()
```

Write `resolves` into `Resolves:` verbatim. **A `0` is never rounded up** — it is the finding
(V044). For XPath, swap `querySelectorAll` for `document.evaluate`.

---

## By purpose

### Seeing

| Purpose | Call |
|---|---|
| Full-page baseline (the one routine screenshot) | `browser_take_screenshot` `fullPage: true`, `filename: screens/baseline.png` |
| On-demand crop of an ambiguous thing | `browser_take_screenshot` targeted at the element/container in question |
| Accessibility tree | `browser_snapshot` — for orientation and for refs to act through |
| Text/regex sweep | `browser_find` — completeness cross-check |

Screenshots taken to be *read* should be read. The pipeline takes few of them by design: the
baseline always, crops only where a DOM answer is genuinely ambiguous.

### Acting

| Purpose | Call | Note |
|---|---|---|
| Click | `browser_click` | `doubleClick`, `button`, `modifiers` available |
| Type | `browser_type` | **Never set `submit: true`** unless the user gave permission for that exact submit |
| Select | `browser_select_option` | The required probe for a native select |
| Hover | `browser_hover` | Hover-revealed controls and tooltips |
| Keyboard | `browser_press_key` | `Escape` to dismiss, `Tab` to walk focus |
| Resize | `browser_resize` | Set the viewport from `conventions.md` at P0 |
| Wait | `browser_wait_for` | `text` / `textGone` beats a fixed `time` — debounced autocompletes need this |

`browser_fill_form` is a bulk form filler and effectively a submit-shaped action — not used for
probing.

### Inspecting after an action

| Purpose | Call |
|---|---|
| Did a request fire | `browser_network_requests` with `filter` — when the DOM diff came back empty |
| Client-side errors | `browser_console_messages` with `level` — explains a probe that "did nothing" |

### Verifying generated code (`generate/verify.md`)

| Purpose | Call |
|---|---|
| Does this locator resolve, and to what | `browser_highlight` then `browser_take_screenshot` — see the highlight land on the intended element |
| Is it present | `browser_verify_element_visible` with `role` + `accessibleName` |
| Does it hold the expected value | `browser_verify_value` |
| Does a collection render as expected | `browser_verify_list_visible` |
| Clean up | `browser_hide_highlight` |

`browser_highlight` + screenshot is the strongest check that a selector points at the element you
*meant*, as opposed to merely resolving to something. Zero matches and ambiguous multi-matches are
both failures.

### Resetting

**`browser_navigate` to the page URL.** That is the reset. Use it whenever state is ambiguous,
after finishing a revealed dialog, or when an overlay will not dismiss. Undoing individual changes
(`Escape`, re-toggling) is fine when it is obviously sufficient — but renavigating is always
correct and never worth agonizing over.

---

## Session and tabs

`browser_tabs` — a click that opens a new tab is a real navigation outcome. Record it in
`Observed:`, analyze the new tab as its own page (its own slug and artifact), and close or switch
back before continuing.

`browser_handle_dialog` — for *native* browser dialogs (`alert`, `confirm`, `beforeunload`), not
application modals. If a probe triggers a native `confirm`, dismiss it; accepting it is a mutating
action needing permission under `00-safety.md`.

Storage, cookie, routing, tracing, video, PDF and coordinate-based mouse tools are not used by
this skill. The storage and cookie families are additionally prohibited by `00-safety.md`.
