#!/usr/bin/env node
/**
 * pom-generator — analysis artifact validator (schema v2)
 *
 * Validates `.pom-generator/analysis/<slug>/analysis.md` against the grammar in
 * references/02-artifact-schema.md.
 *
 * Zero dependencies. Node 18+.
 *
 *   node validate-analysis.mjs [--phase=<phase>] [--json] <dir-or-file>
 *   node validate-analysis.mjs --self-test
 *
 * Exit: 0 clean · 1 errors · 2 warnings only.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_INDEX = resolve(HERE, '../skills/pom-generator/references/catalog/index.md');
const FIXTURES = resolve(HERE, 'fixtures');

// ---------------------------------------------------------------- constants

const PHASES = ['inventory', 'probed', 'classified', 'generated'];
const phaseAtLeast = (current, required) =>
  PHASES.indexOf(current) >= PHASES.indexOf(required);

const SECTIONS = ['Meta', 'Regions', 'Elements', 'Component tree', 'Output manifest'];

const META_FIELDS = ['URL', 'Slug', 'Analyzed', 'Viewport', 'Baseline', 'Phase',
  'Conventions', 'Selector-strategy', 'Tools-degraded', 'Notes'];
const META_REQUIRED = ['URL', 'Slug', 'Analyzed', 'Viewport', 'Baseline', 'Phase'];

const REGION_FIELDS = ['Root', 'Resolves', 'Contains', 'Box', 'Shot', 'Component',
  'Open-path', 'Notes'];
const REGION_REQUIRED = ['Root', 'Resolves', 'Contains'];

const ELEMENT_FIELDS = ['Region', 'Scope', 'Text', 'DOM', 'Selector', 'Resolves', 'Box',
  'Kind', 'Type', 'Registry', 'Class', 'Class-ref', 'Status',
  'Probe', 'Value-source', 'Observed', 'Open-path', 'Reveals', 'Affects',
  'Locator', 'Notes'];
const ELEMENT_REQUIRED_AT = {
  inventory: ['Region', 'Scope', 'Selector', 'Resolves', 'Kind', 'Type', 'Status'],
  classified: ['Locator'],
};

const DELTA_FIELDS = ['Against', 'Added', 'Removed', 'Changed', 'Unchanged'];

const ACTION_VERBS = ['Typed', 'Clicked', 'Double-clicked', 'Selected', 'Toggled', 'Checked',
  'Unchecked', 'Hovered', 'Pressed', 'Uploaded', 'Dragged', 'Scrolled',
  'Expanded', 'Collapsed', 'Read'];

const KINDS = ['actionable', 'static', 'container'];
const SIMPLE_STATUSES = ['pending', 'recognized', 'probed', 'probed-by-class',
  'static-confirmed', 'removed'];

/**
 * Families whose behaviour is never readable from attributes: what a select does depends on
 * what happens when you select, and a conditional field that appears on the third option is
 * invisible to any amount of DOM reading. `Probe: Read` on these is the shortcut that
 * produces a confident, wrong artifact (V019).
 */
const MUST_INTERACT = ['inputs', 'selection', 'temporal', 'collections'];

/**
 * A Page Object's locators are relative to the thing that owns them, so a selector only means
 * anything together with the frame it resolves in. A cell selector matches once per row when
 * asked inside a row, and once per row *in total* when asked of the document.
 *
 * `Scope:` names that frame: `page`, a region, or a container element.
 */
const PAGE_SCOPE = 'page';

/**
 * The root expression a locator hangs off, in whatever language the project writes. Matching on
 * the shape rather than on the literal `this.element` is what lets a Python project using
 * `self.element` or `self._root` validate at all.
 */
const ROOT_RE = /^(this|self)\.([A-Za-z_]\w*)/;

/** Where a typed probe value came from. See `05-probe-values.md`. */
const VALUE_SOURCES = ['page-data', 'constraint', 'label', 'synthetic'];

/**
 * Controls that match user input against real data. A synthetic token searches for something
 * that by construction does not exist, so the probe observes an empty state and learns nothing
 * about the populated one — which is the state a wrapper has to support.
 */
const MATCHING_TYPES = ['inputs/search', 'inputs/autocomplete'];

/**
 * The action a type's behaviour is only observable through, transcribed from each catalog
 * entry's `**Required probe:**` line.
 *
 * The general verb check (V011) asks whether *an* action happened. That is not enough for the
 * types listed here, because the cheap action and the required one are both legal verbs: you can
 * click a dropdown open, look at it, press Escape, and record `Probe: Clicked` — a sentence that
 * passes every check while leaving the selection behaviour, and anything a selection reveals,
 * entirely untested.
 *
 * Absent from this table means the catalog accepts any real action for that type.
 */
const REQUIRED_VERBS = {
  'inputs/text': ['Typed'],
  'inputs/textarea': ['Typed'],
  'inputs/number': ['Typed'],
  'inputs/search': ['Typed'],
  'inputs/autocomplete': ['Typed', 'Selected'],
  'inputs/masked': ['Typed'],
  'inputs/rich-text': ['Typed'],
  'inputs/password': ['Typed'],
  'selection/single-select': ['Selected'],
  'selection/multi-select': ['Selected'],
  'selection/radio-group': ['Selected'],
  'selection/segmented': ['Selected', 'Clicked'],
  'selection/checkbox': ['Toggled', 'Checked', 'Unchecked'],
  'selection/toggle': ['Toggled', 'Checked', 'Unchecked'],
  'selection/slider': ['Dragged', 'Pressed'],
  'temporal/date': ['Selected', 'Typed'],
  'temporal/datetime': ['Selected', 'Typed'],
  'temporal/date-range': ['Selected', 'Typed'],
  'collections/sortable-header': ['Clicked'],
  'collections/pagination': ['Clicked'],
  'collections/tree': ['Expanded', 'Clicked'],
  'collections/virtualized-list': ['Scrolled'],
};

/**
 * Values a framework mints at runtime or a bundler mints at build time. They look like perfectly
 * good hooks in a single snapshot and differ on the next load or the next deploy, which makes
 * them the one selector defect that gets past grounding, compilation and a first green run.
 *
 * The authority is still the reload comparison in `04-selectors.md` S1; this is the shortcut for
 * the shapes that are recognisable on sight.
 */
const GENERATED_SELECTOR = [
  // `#:r7:` or, CSS-escaped as it must be to be a legal selector, `#\:r7\:`. Anchored on the
  // preceding character and length-bounded so ordinary pseudo-classes (`input:required:invalid`)
  // are not mistaken for it.
  [/(?:^|[#'"[=\s])\\?:r[0-9a-z]{1,4}\\?:/i, 'a React useId value'],
  [/react-aria[-_0-9]/i, 'a React Aria generated id'],
  [/\b(radix|headlessui|mui|chakra|ember)[-_][0-9a-z]{3,}/i, 'a component-library generated id'],
  [/\.(css|sc|emotion)-[a-z0-9]{5,}/i, 'a CSS-in-JS generated class'],
  // an exact CSS-module class including its build hash, rather than the authored stem
  [/\._[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_-]{4,8}\b/, 'a CSS-module class including its build hash'],
];

const DIALOGISH = /\b(dialog|modal|drawer|popup|popover|sheet|lightbox)\b/i;
const LISTISH = /\b(dropdown|listbox|menu|autocomplete|suggestion|typeahead|combobox list)\b/i;

const RULE_DESC = {
  V001: 'file header and version comment',
  V002: 'five sections, once each, in order',
  V003: 'field lines parse and field names are known',
  V004: 'block headers well-formed and IDs unique',
  V010: 'no element left pending',
  V011: 'probed element must have a real probe action',
  V012: 'probed element must have a substantive observation',
  V013: 'Type must exist in the catalog',
  V014: 'Kind and Status must agree',
  V017: 'every equivalence class needs one probed member',
  V018: 'an inherited outcome must name the member it came from',
  V019: 'behaviour of this type is only observable by interacting',
  V020: 'element Region must resolve',
  V021: 'region Contains must resolve',
  V022: 'Reveals must resolve',
  V023: 'revealed component must appear in the component tree',
  V024: 'Affects must resolve',
  V025: 'element/region membership must agree both ways',
  V030: 'dialog revealed but no component planned',
  V031: 'list/dropdown revealed but nothing recorded as revealed',
  V040: 'locator must hang off a component or page root',
  V041: 'a scoped element must not reach the page',
  V043: 'Resolves must be a match count taken from the live page',
  V044: 'selector matched nothing within its scope',
  V045: 'selector is ambiguous within its scope and nothing explains why',
  V046: 'Scope must resolve to the page, a region, or a container',
  V047: 'scope chain must reach the page without looping',
  V048: 'an element can only be scoped inside a container in its own region',
  V049: 'a typed probe must record where its value came from',
  V050: 'component tree entry must have an output manifest row',
  V051: 'region must contain at least one element',
  V052: 'every region must be accounted for in the component tree',
  V060: 'every manifest row must be written',
  V061: 'a removed element must show the page no longer has it',
  V071: 'Box must be four numbers describing a rendered element',
  V080: 'a recognized element must name the registry class it matched',
  V081: 'a revealed container must record how to open it',
  W001: 'element could not be probed',
  W003: 'unmatched widget type, candidate for a new catalog entry',
  W004: 'region is large enough that it probably needs decomposing',
  W005: 'marked NEW although the same type is wrapped elsewhere',
  W007: 'the locator does not contain the selector it was grounded from',
  W009: 'a matching control was probed with a value that cannot match',
  W010: 'selector rests on a value the framework generates',
  W011: 'container marked NEW with no record that the registry was checked',
};

/** `x,y,w,h` in CSS pixels. Fractional values are normal — layout is not integral. */
function parseBox(value) {
  const parts = String(value || '').split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts;
  return { x, y, w, h };
}

// ---------------------------------------------------------------- parsing

function parse(content) {
  const lines = content.split(/\r?\n/);
  const doc = {
    lines,
    firstLine: (lines[0] || '').trim(),
    hasVersion: lines.slice(0, 4).some((l) => l.trim() === '<!-- pom-generator/analysis v2 -->'),
    sectionOrder: [],
    meta: { fields: new Map() },
    delta: null,
    regions: [],
    elements: [],
    tree: [],
    manifest: [],
    badFieldLines: [],
    badHeaders: [],
  };

  const FIELD_RE = /^\*\*([^*:]+):\*\*[ \t]*(.*)$/;
  const LOOSE_FIELD_RE = /^\s*\*\*[^*]+\*\*\s*:?/;
  const BLOCK_RE = /^###\s+([A-Z]-\d{2,})\s*[—–-]\s*(.+?)\s*$/;
  const TREE_RE = /^(\s*)-\s+\*\*([A-Za-z_$][\w$]*)\*\*\s*(?:→|->)\s*`([^`]+)`\s*\[([^\]]+)\]\s*(?:\((.*)\))?\s*$/;

  let section = null;
  let block = null; // {kind:'region'|'element', obj}

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const n = i + 1;

    const sec = /^##\s+(.+?)\s*$/.exec(line);
    if (sec && !line.startsWith('###')) {
      section = sec[1];
      doc.sectionOrder.push({ name: section, line: n });
      block = null;
      if (section === 'Delta') doc.delta = { line: n, fields: new Map() };
      continue;
    }

    const blk = BLOCK_RE.exec(line);
    if (line.startsWith('### ')) {
      if (!blk) {
        doc.badHeaders.push({ line: n, text: line });
        block = null;
        continue;
      }
      const [, id, name] = blk;
      const obj = { id, name, line: n, fields: new Map() };
      if (section === 'Regions' && id.startsWith('R-')) {
        doc.regions.push(obj);
        block = { kind: 'region', obj };
      } else if (section === 'Elements' && id.startsWith('E-')) {
        doc.elements.push(obj);
        block = { kind: 'element', obj };
      } else {
        doc.badHeaders.push({ line: n, text: line });
        block = null;
      }
      continue;
    }

    const f = FIELD_RE.exec(line);
    if (f) {
      const name = f[1].trim();
      const value = f[2].trim();
      const entry = { value, line: n };
      if (block) block.obj.fields.set(name, entry);
      else if (section === 'Meta') doc.meta.fields.set(name, entry);
      else if (section === 'Delta' && doc.delta) doc.delta.fields.set(name, entry);
      continue;
    }
    if (LOOSE_FIELD_RE.test(line) && !TREE_RE.test(line)) {
      doc.badFieldLines.push({ line: n, text: line.trim() });
      continue;
    }

    if (section === 'Component tree') {
      const t = TREE_RE.exec(line);
      if (t) {
        doc.tree.push({
          indent: t[1].length,
          className: t[2],
          path: t[3],
          marker: t[4].trim(),
          note: (t[5] || '').trim(),
          line: n,
        });
      } else if (/^\s*-\s+\S/.test(line)) {
        doc.badFieldLines.push({ line: n, text: line.trim() });
      }
      continue;
    }

    if (section === 'Output manifest' && line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length === 4 && !/^-+$/.test(cells[0]) && cells[0] !== 'File') {
        doc.manifest.push({
          file: cells[0], className: cells[1], kind: cells[2], status: cells[3], line: n,
        });
      }
    }
  }

  return doc;
}

/**
 * The canonical type list lives in catalog/index.md under a "## Canonical type ids"
 * heading. Only that section is scanned, so backticked file paths elsewhere in the
 * document cannot leak in as bogus types.
 */
function loadCatalogTypes() {
  if (!existsSync(CATALOG_INDEX)) return null;
  const txt = readFileSync(CATALOG_INDEX, 'utf8');
  const start = txt.search(/^##\s+Canonical type ids\s*$/m);
  if (start === -1) return null;
  const rest = txt.slice(start + 1);
  const end = rest.search(/^##\s+/m);
  const section = end === -1 ? rest : rest.slice(0, end);
  const types = new Set();
  for (const m of section.matchAll(/`([a-z][a-z0-9]*\/[a-z0-9][a-z0-9-]*)`/g)) types.add(m[1]);
  return types.size ? types : null;
}

// ---------------------------------------------------------------- validation

export function validateContent(content, opts = {}) {
  const doc = parse(content);
  const errors = [];
  const warnings = [];
  const err = (rule, line, id, msg) => errors.push({ rule, line, id, msg });
  const warn = (rule, line, id, msg) => warnings.push({ rule, line, id, msg });

  const declared = doc.meta.fields.get('Phase')?.value;
  const phase = opts.phase || (PHASES.includes(declared) ? declared : 'inventory');
  const at = (p) => phaseAtLeast(phase, p);

  const fv = (o, name) => o.fields.get(name)?.value;
  const fl = (o, name) => o.fields.get(name)?.line ?? o.line;
  const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

  // ---- V001
  if (!/^# Analysis: .+/.test(doc.firstLine)) {
    err('V001', 1, '', 'first line must be "# Analysis: <name>"');
  }
  if (!doc.hasVersion) {
    err('V001', 2, '', 'missing "<!-- pom-generator/analysis v2 -->" in the first lines');
  }

  // ---- V002
  const seen = doc.sectionOrder.filter((s) => SECTIONS.includes(s.name));
  for (const want of SECTIONS) {
    const hits = seen.filter((s) => s.name === want);
    if (hits.length === 0) err('V002', 1, '', `missing section "## ${want}"`);
    else if (hits.length > 1) {
      err('V002', hits[1].line, '', `section "## ${want}" appears ${hits.length} times`);
    }
  }
  const order = seen.map((s) => s.name).filter((n, i, a) => a.indexOf(n) === i);
  const wanted = SECTIONS.filter((s) => order.includes(s));
  if (order.join('>') !== wanted.join('>')) {
    err('V002', seen[0]?.line || 1, '', `sections out of order: ${order.join(' > ')}`);
  }
  const deltaIdx = doc.sectionOrder.findIndex((s) => s.name === 'Delta');
  if (deltaIdx > -1 && doc.sectionOrder[deltaIdx - 1]?.name !== 'Meta') {
    err('V002', doc.sectionOrder[deltaIdx].line, '', '"## Delta" must come directly after "## Meta"');
  }

  // ---- V003 / V004
  for (const b of doc.badFieldLines) {
    err('V003', b.line, '', `malformed line: ${b.text.slice(0, 60)}`);
  }
  for (const b of doc.badHeaders) {
    err('V004', b.line, '', `malformed or misplaced block header: ${b.text.slice(0, 60)}`);
  }
  const checkNames = (o, allowed, label) => {
    for (const [name, e] of o.fields) {
      if (!allowed.includes(name)) err('V003', e.line, o.id || label, `unknown field "${name}"`);
    }
  };
  checkNames(doc.meta, META_FIELDS, 'Meta');
  if (doc.delta) checkNames(doc.delta, DELTA_FIELDS, 'Delta');
  for (const r of doc.regions) checkNames(r, REGION_FIELDS, r.id);
  for (const e of doc.elements) checkNames(e, ELEMENT_FIELDS, e.id);

  for (const name of META_REQUIRED) {
    if (!doc.meta.fields.has(name)) err('V003', 1, 'Meta', `missing required field "${name}"`);
  }
  if (declared !== undefined && !PHASES.includes(declared)) {
    err('V003', fl(doc.meta, 'Phase'), 'Meta', `Phase must be one of ${PHASES.join(', ')}`);
  }
  if (doc.meta.fields.has('Viewport') && !/^\d+x\d+$/.test(fv(doc.meta, 'Viewport'))) {
    err('V003', fl(doc.meta, 'Viewport'), 'Meta', 'Viewport must look like 1440x900');
  }

  const dupe = new Set();
  for (const o of [...doc.regions, ...doc.elements]) {
    if (dupe.has(o.id)) err('V004', o.line, o.id, 'duplicate ID');
    dupe.add(o.id);
  }

  const regionById = new Map(doc.regions.map((r) => [r.id, r]));
  const elementById = new Map(doc.elements.map((e) => [e.id, e]));
  const componentIds = new Set(
    doc.regions.map((r) => fv(r, 'Component')).filter(Boolean),
  );
  const treeText = doc.tree.map((t) => `${t.className} ${t.path} ${t.marker} ${t.note}`).join('\n');

  /**
   * A selector is a claim about the page, and `Resolves:` is what turns it into a checkable
   * one: the count the run got back when it asked the live page how many nodes this matches.
   * Without it, a fabricated selector is indistinguishable from a real one until the generated
   * code fails — which is much later and much more expensive.
   */
  const checkResolves = (o, selectorField, expectGone = false) => {
    const raw = fv(o, 'Resolves');
    if (raw === undefined) return null;
    if (!/^\d+$/.test(raw.trim())) {
      err('V043', fl(o, 'Resolves'), o.id, `Resolves must be a whole match count, got "${raw}"`);
      return null;
    }
    const n = Number.parseInt(raw, 10);
    // for a removed element, zero is the evidence rather than the defect (V061)
    if (n === 0 && !expectGone) {
      err('V044', fl(o, selectorField), o.id,
        `${selectorField} matched nothing — it was not taken from the page it describes`);
    }
    return n;
  };

  // ---- V071
  const checkBox = (o) => {
    const raw = fv(o, 'Box');
    if (raw === undefined) return;
    const box = parseBox(raw);
    if (!box) {
      err('V071', fl(o, 'Box'), o.id, `Box must be "x,y,w,h", got "${raw}"`);
      return;
    }
    if (box.w <= 0 || box.h <= 0) {
      err('V071', fl(o, 'Box'), o.id,
        `Box is ${box.w}x${box.h} — a zero-sized element was not on screen when it was measured`);
    }
  };

  for (const r of doc.regions) {
    for (const name of REGION_REQUIRED) {
      if (!r.fields.has(name)) err('V003', r.line, r.id, `missing required field "${name}"`);
    }
    checkResolves(r, 'Root');
    checkBox(r);

    // ---- V081
    // A revealed container's Open-path is what the generated opener method, the verify step,
    // and every future re-analysis reproduce the state from. Without it the dialog exists in
    // the artifact and nowhere else.
    if (at('probed') && fv(r, 'Component') && !(fv(r, 'Open-path') || '').trim()) {
      err('V081', fl(r, 'Component'), r.id,
        `revealed as ${fv(r, 'Component')} but no Open-path: records how to open it`);
    }
  }

  const catalog = loadCatalogTypes();

  for (const e of doc.elements) {
    const kind = fv(e, 'Kind');
    const status = fv(e, 'Status');
    const isActionable = kind === 'actionable';
    const inherited = status === 'probed-by-class';
    const isRemoved = status === 'removed';

    const required = [...ELEMENT_REQUIRED_AT.inventory];
    // Recognition happens at inventory: every actionable element and every container leaves
    // the inventory pass either matched to a registry class or explicitly NEW. Static text
    // gets no wrapper, so it owes no Registry.
    if ((isActionable || kind === 'container') && !isRemoved) required.push('Registry');
    if (at('classified') && !isRemoved) required.push('Locator');
    if (at('probed') && status === 'probed') required.push('Probe', 'Observed');

    for (const name of required) {
      if (!e.fields.has(name)) err('V003', e.line, e.id, `missing required field "${name}"`);
    }

    if (kind !== undefined && !KINDS.includes(kind)) {
      err('V003', fl(e, 'Kind'), e.id, `Kind must be one of ${KINDS.join(', ')}`);
    }
    if (status !== undefined
        && !SIMPLE_STATUSES.includes(status)
        && !/^blocked-[a-z][a-z0-9-]*$/.test(status)) {
      err('V003', fl(e, 'Status'), e.id, `illegal Status "${status}"`);
    }

    // ---- V013
    const type = fv(e, 'Type');
    if (type !== undefined) {
      if (!/^[a-z][a-z0-9]*\/[a-z0-9][a-z0-9-]*$/.test(type)) {
        err('V013', fl(e, 'Type'), e.id, `Type "${type}" is not a family/name id`);
      } else if (catalog && !catalog.has(type) && !type.startsWith('other/')) {
        err('V013', fl(e, 'Type'), e.id, `Type "${type}" is not in catalog/index.md`);
      }
      if (type === 'other/unknown' || (type.startsWith('other/') && catalog && !catalog.has(type))) {
        warn('W003', fl(e, 'Type'), e.id, `unmatched type "${type}" — candidate for a catalog entry`);
      }
    }

    // ---- V080
    // `recognized` is a claim that the registry already wraps this. NEW contradicts the claim,
    // and an empty Registry leaves it unbacked — either way nothing downstream can import a
    // class that was never named.
    const registry = fv(e, 'Registry');
    if (status === 'recognized' && (!registry || registry === 'NEW')) {
      err('V080', fl(e, 'Status'), e.id,
        'Status: recognized requires Registry: naming the matched wrapper class');
    }

    // ---- V046 / V047 / V048
    const scope = fv(e, 'Scope');
    let scopeOk = false;
    if (scope !== undefined) {
      if (scope === PAGE_SCOPE) {
        scopeOk = true;
      } else if (regionById.has(scope)) {
        scopeOk = true;
        if (fv(e, 'Region') !== undefined && fv(e, 'Region') !== scope) {
          err('V048', fl(e, 'Scope'), e.id,
            `scoped to ${scope} but filed under region ${fv(e, 'Region')}`);
        }
      } else if (elementById.has(scope)) {
        const host = elementById.get(scope);
        scopeOk = true;
        if (fv(host, 'Kind') !== 'container') {
          err('V048', fl(e, 'Scope'), e.id,
            `${scope} is Kind: ${fv(host, 'Kind') || '(unset)'} — only a container can scope others`);
        }
        if (fv(host, 'Region') !== fv(e, 'Region')) {
          err('V048', fl(e, 'Scope'), e.id,
            `${scope} is in region ${fv(host, 'Region')}, this element is in ${fv(e, 'Region')}`);
        }
      } else {
        err('V046', fl(e, 'Scope'), e.id,
          `Scope "${scope}" is not "page", a region, or an element`);
      }

      // walk to the page; a cycle here would otherwise hang the grounding pass
      if (scopeOk) {
        const seenIds = new Set([e.id]);
        let cur = scope;
        while (cur !== PAGE_SCOPE && elementById.has(cur)) {
          if (seenIds.has(cur)) {
            err('V047', fl(e, 'Scope'), e.id,
              `scope chain loops: ${[...seenIds].join(' -> ')} -> ${cur}`);
            break;
          }
          seenIds.add(cur);
          cur = fv(elementById.get(cur), 'Scope') ?? PAGE_SCOPE;
        }
      }
    }

    // ---- W010
    const selRaw = (fv(e, 'Selector') || '').replace(/^`|`$/g, '');
    for (const [re, what] of GENERATED_SELECTOR) {
      if (re.test(selRaw)) {
        warn('W010', fl(e, 'Selector'), e.id,
          `Selector rests on ${what} — reload the page and compare before trusting it`);
        break;
      }
    }

    // ---- V043 / V044 / V045 / V061
    const resolves = checkResolves(e, 'Selector', isRemoved);
    checkBox(e);
    if (isRemoved) {
      // Deleting an element is the one edit that destroys information. Setting the status must
      // not be enough on its own — that is how a conditional control, one that only exists after
      // some other field is set, gets written out of an artifact on the strength of not having
      // been seen.
      if (resolves === null) {
        err('V061', fl(e, 'Status'), e.id,
          'removal needs Resolves: 0 recorded against a fresh load of the page');
      } else if (resolves > 0) {
        err('V061', fl(e, 'Resolves'), e.id,
          `still resolves to ${resolves} node(s) — it is present, not removed`);
      }
      const gone = list(fv(doc.delta || { fields: new Map() }, 'Removed'))
        .map((t) => t.split(/\s|\(/)[0]);
      if (!doc.delta) {
        err('V061', fl(e, 'Status'), e.id,
          'an element can only be removed by a re-analysis, which must write a ## Delta section');
      } else if (!gone.includes(e.id)) {
        err('V061', fl(e, 'Status'), e.id, `not listed in the Delta's Removed: field`);
      }
    }
    // Resolves is counted *within* Scope, so >1 is a genuine collection (rows, options, cards)
    // rather than the artifact of asking a document-wide question about a component-local
    // selector. A collection is addressed by index or text at runtime, so it is expected.
    if (resolves !== null && resolves > 1
        && !fv(e, 'Class') && kind !== 'container') {
      err('V045', fl(e, 'Selector'), e.id,
        `Selector matches ${resolves} nodes inside ${scope || 'its scope'} — `
        + 'scope it deeper, or declare the group with Class:');
    }

    // ---- V018
    if (inherited) {
      const ref = fv(e, 'Class-ref');
      const cls = fv(e, 'Class');
      if (!cls) {
        err('V018', fl(e, 'Status'), e.id, 'Status: probed-by-class requires a Class:');
      }
      if (!ref) {
        err('V018', fl(e, 'Status'), e.id,
          'inherited outcome must name the element it was inherited from in Class-ref');
      } else {
        const src = elementById.get(ref);
        if (!src) {
          err('V018', fl(e, 'Class-ref'), e.id, `Class-ref "${ref}" does not resolve`);
        } else if (src.id === e.id) {
          err('V018', fl(e, 'Class-ref'), e.id, 'Class-ref cannot point at itself');
        } else if (fv(src, 'Class') !== cls) {
          err('V018', fl(e, 'Class-ref'), e.id,
            `Class-ref "${ref}" is in class "${fv(src, 'Class') || '(none)'}", not "${cls}"`);
        } else if (fv(src, 'Status') !== 'probed') {
          err('V018', fl(e, 'Class-ref'), e.id,
            `Class-ref "${ref}" was not itself probed (Status: ${fv(src, 'Status')})`);
        }
      }
    } else if (fv(e, 'Class-ref')) {
      err('V018', fl(e, 'Class-ref'), e.id,
        'Class-ref is only for an element whose Status is probed-by-class');
    }

    // ---- V014
    if (kind === 'static' && status && status !== 'static-confirmed' && status !== 'removed') {
      err('V014', fl(e, 'Status'), e.id, 'Kind: static requires Status: static-confirmed');
    }
    if (isActionable && status === 'static-confirmed') {
      err('V014', fl(e, 'Status'), e.id, 'Kind: actionable cannot be static-confirmed');
    }

    // ---- V010
    if (at('probed') && status === 'pending') {
      err('V010', fl(e, 'Status'), e.id, 'still pending — probe it before generating');
    }
    if ((status || '').startsWith('blocked-')) {
      warn('W001', fl(e, 'Status'), e.id, `not probed: ${status}`);
    }

    // ---- V011 / V012 / V019 / V049 / V030 / V031
    if (at('probed') && status === 'probed') {
      const probe = fv(e, 'Probe') || '';
      const verb = probe.split(/[\s"]/)[0];
      const reveals = list(fv(e, 'Reveals'));
      if (!ACTION_VERBS.includes(verb)) {
        err('V011', fl(e, 'Probe'), e.id,
          probe.trim() ? `"${probe.slice(0, 40)}" does not start with an action verb` : 'empty Probe');
      }
      const needed = REQUIRED_VERBS[type];
      if (needed && verb !== 'Read' && !needed.includes(verb)) {
        err('V011', fl(e, 'Probe'), e.id,
          `${type} is only exercised by ${needed.join(' or ')}, not "${verb}" — `
          + 'see its catalog entry');
      }
      // `Read` states that a conclusion came from an attribute the DOM already carries — an
      // href, a disabled flag. Honest for a link; a dodge for anything whose behaviour only
      // exists at interaction time.
      if (verb === 'Read') {
        const family = (type || '').split('/')[0];
        if (MUST_INTERACT.includes(family)) {
          err('V019', fl(e, 'Probe'), e.id,
            `Probe: Read is not available for ${family}/* — its behaviour is only observable by interacting`);
        }
        if (reveals.length) {
          err('V019', fl(e, 'Probe'), e.id,
            'Probe: Read cannot reveal anything — something that opens a dialog or list must be acted on');
        }
      }
      const observed = fv(e, 'Observed') || '';
      if (observed.length < 20) {
        err('V012', fl(e, 'Observed'), e.id,
          `observation too thin to be a real result (${observed.length} chars)`);
      }

      // A typed value is an experiment, and where it came from is what makes the result mean
      // anything. See `05-probe-values.md`.
      if (verb === 'Typed') {
        const source = fv(e, 'Value-source');
        if (source === undefined) {
          err('V049', fl(e, 'Probe'), e.id,
            'a typed value needs Value-source: page-data, constraint, label, or synthetic');
        } else if (!VALUE_SOURCES.includes(source)) {
          err('V049', fl(e, 'Value-source'), e.id,
            `Value-source must be one of ${VALUE_SOURCES.join(', ')}`);
        } else if (source === 'synthetic') {
          // "it filters something" is the observable definition of a matching control, and it
          // is more reliable than the declared type
          const filters = MATCHING_TYPES.includes(type)
            || (String(type).startsWith('inputs/') && list(fv(e, 'Affects')).length > 0);
          if (filters) {
            warn('W009', fl(e, 'Value-source'), e.id,
              'a synthetic value cannot match real data — use a value taken from the page');
          }
        }
      }

      // ---- V030 / V031
      if (DIALOGISH.test(observed) && !reveals.some((r) => r.startsWith('C-'))) {
        err('V030', fl(e, 'Observed'), e.id,
          'observation mentions a dialog but no C-nn component is recorded in Reveals');
      }
      if (LISTISH.test(observed) && reveals.length === 0) {
        err('V031', fl(e, 'Observed'), e.id,
          'observation mentions a dropdown/list but Reveals is empty');
      }
    }

    // ---- V020 / V024 / V025
    const rid = fv(e, 'Region');
    if (rid !== undefined) {
      const region = regionById.get(rid);
      if (!region) err('V020', fl(e, 'Region'), e.id, `region "${rid}" does not exist`);
      else if (!list(fv(region, 'Contains')).includes(e.id)) {
        err('V025', fl(e, 'Region'), e.id, `${rid} does not list ${e.id} in Contains`);
      }
    }
    for (const a of list(fv(e, 'Affects'))) {
      if (!elementById.has(a) && !regionById.has(a) && !componentIds.has(a)) {
        err('V024', fl(e, 'Affects'), e.id, `Affects "${a}" does not resolve`);
      }
    }

    // ---- V022 / V023
    if (at('probed')) {
      for (const r of list(fv(e, 'Reveals'))) {
        const known = elementById.has(r) || regionById.has(r) || componentIds.has(r);
        if (!known) err('V022', fl(e, 'Reveals'), e.id, `Reveals "${r}" does not resolve`);
        else if (r.startsWith('C-') && !treeText.includes(r)) {
          err('V023', fl(e, 'Reveals'), e.id, `${r} is revealed but absent from the component tree`);
        }
      }
    }

    // ---- V040 / V041 / W007
    if (at('classified')) {
      const loc = fv(e, 'Locator');
      if (loc !== undefined) {
        const inner = loc.replace(/^`|`$/g, '').trim();
        const root = inner.match(ROOT_RE);
        if (!root) {
          err('V040', fl(e, 'Locator'), e.id,
            'must hang off a component or page root — this.element, self.element, self._root, '
            + 'this.page, whatever this project calls it');
        } else if (scope !== undefined && scope !== PAGE_SCOPE && /page/i.test(root[2])) {
          // the defect this rule exists for: a component that searches the whole document.
          // It breaks the moment the component is reused, and it silently couples it to a page.
          err('V041', fl(e, 'Locator'), e.id,
            `scoped to ${scope} but rooted at ${root[0]} — a component locates from its own root`);
        }
        // a page handle smuggled into the body of an otherwise correctly rooted locator
        if (root && scope !== PAGE_SCOPE
            && /\b(?<!this\.)(?<!self\.)page\./.test(inner.slice(root[0].length))) {
          err('V041', fl(e, 'Locator'), e.id, 'reaches the page from inside a component');
        }
      }
      // `Selector:` was checked against the live page; `Locator:` is what actually gets
      // written into the wrapper. When the second stops containing the first, the grounding
      // no longer covers the thing being generated. A role- or label-based locator is a
      // different expression of the same node, not an ungrounded one; only a raw selector
      // string passed to locator() makes a claim Selector: was supposed to have checked.
      const sel = (fv(e, 'Selector') || '').replace(/^`|`$/g, '').trim();
      const locRaw = (fv(e, 'Locator') || '').replace(/^`|`$/g, '').trim();
      const norm = (s) => s.replace(/["']/g, '"').replace(/\s+/g, '');
      const args = [...locRaw.matchAll(/\.locator\(\s*(['"])([\s\S]*?)\1/g)].map((m) => m[2]);
      if (sel && args.length
          && !args.some((a) => norm(a).includes(norm(sel)) || norm(sel).includes(norm(a)))) {
        warn('W007', fl(e, 'Locator'), e.id,
          `Locator selects on ${args[0].slice(0, 30)} but Selector: grounded ${sel.slice(0, 30)}`);
      }
    }
  }

  // ---- V017
  // Declared extrapolation is only worth anything if somebody actually did the work once.
  // A class where every member inherited is a class where nothing was ever observed.
  if (at('probed')) {
    const classes = new Map();
    for (const e of doc.elements) {
      const cls = fv(e, 'Class');
      if (!cls) continue;
      if (!classes.has(cls)) classes.set(cls, []);
      classes.get(cls).push(e);
    }
    for (const [cls, members] of classes) {
      const probed = members.filter((m) => fv(m, 'Status') === 'probed');
      if (probed.length === 0) {
        err('V017', fl(members[0], 'Class'), members[0].id,
          `class "${cls}" has ${members.length} members and none of them was probed`);
      }
    }
  }

  // ---- W005
  const wrapped = new Map();
  for (const e of doc.elements) {
    const reg = fv(e, 'Registry');
    const type = fv(e, 'Type');
    if (reg && reg !== 'NEW' && type) wrapped.set(type, reg);
  }
  for (const e of doc.elements) {
    const type = fv(e, 'Type');
    if (fv(e, 'Registry') === 'NEW' && type && wrapped.has(type)) {
      warn('W005', fl(e, 'Registry'), e.id,
        `same type is already wrapped by ${wrapped.get(type)}`);
    }
  }

  // ---- W011
  // W005 only catches a registry miss when this same run already wrapped the same `Type:`
  // elsewhere — it never reads component-registry.md, because fuzzily matching a DOM shape
  // against that file's free-form prose isn't something a script can do. The recognition pass
  // puts that comparison on the model instead ("close but different -> NEW plus a Notes: line"),
  // and requiring a Notes: line on every NEW container is the cheap proxy that forces the
  // comparison onto the page, even when the answer is "nothing in the registry resembles this."
  for (const e of doc.elements) {
    if (fv(e, 'Kind') === 'container' && fv(e, 'Registry') === 'NEW' && !fv(e, 'Notes')) {
      warn('W011', fl(e, 'Registry'), e.id,
        'no Notes: — record what in component-registry.md this was compared against');
    }
  }

  // ---- V021 / V051 / W004
  for (const r of doc.regions) {
    const contains = list(fv(r, 'Contains'));
    if (contains.length === 0) {
      err('V051', fl(r, 'Contains'), r.id, 'region contains no elements');
    }
    if (contains.length > 15) {
      warn('W004', fl(r, 'Contains'), r.id, `${contains.length} elements — decompose further?`);
    }
    for (const id of contains) {
      if (!elementById.has(id)) {
        err('V021', fl(r, 'Contains'), r.id, `Contains "${id}" does not exist`);
      }
    }
  }

  // ---- V050 / V052 / V060
  // The tree and manifest exist from the checkpoint on, and they grow during probing as
  // containers are revealed — so these hold at every phase from inventory.
  const manifestFiles = new Set(doc.manifest.map((m) => m.file));
  for (const t of doc.tree) {
    if (!/^REUSE\b/.test(t.marker) && !manifestFiles.has(t.path)) {
      err('V050', t.line, t.className, `no output manifest row for ${t.path}`);
    }
  }
  for (const r of doc.regions) {
    if (!treeText.includes(r.id) && !/page-level/i.test(fv(r, 'Notes') || '')) {
      err('V052', r.line, r.id,
        'region is not referenced by any component tree entry and is not marked page-level');
    }
  }
  if (at('generated')) {
    for (const m of doc.manifest) {
      if (!['written', 'verified', 'skipped-reuse'].includes(m.status)) {
        err('V060', m.line, m.className, `manifest status is "${m.status}"`);
      }
    }
  }

  return { errors, warnings, phase, counts: {
    regions: doc.regions.length, elements: doc.elements.length,
    tree: doc.tree.length, manifest: doc.manifest.length,
  } };
}

// ---------------------------------------------------------------- reporting

function report(result, file) {
  const groups = new Map();
  for (const e of [...result.errors, ...result.warnings]) {
    if (!groups.has(e.rule)) groups.set(e.rule, []);
    groups.get(e.rule).push(e);
  }
  const out = [];
  for (const rule of [...groups.keys()].sort()) {
    const items = groups.get(rule);
    const kind = rule.startsWith('W') ? 'warning' : 'error';
    const label = `${items.length} ${kind}${items.length === 1 ? '' : 's'}`;
    out.push(`${rule}  ${RULE_DESC[rule] || ''}`.padEnd(66) + label);
    for (const i of items) {
      const id = i.id ? ` ${i.id}` : '';
      out.push(`  ${file}:${i.line}${id}  ${i.msg}`);
    }
    out.push('');
  }
  const e = result.errors.length;
  const w = result.warnings.length;
  out.push(`${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'}  `
    + `(phase: ${result.phase}; ${result.counts.elements} elements, `
    + `${result.counts.regions} regions, ${result.counts.manifest} planned files)`);
  return out.join('\n');
}

// ---------------------------------------------------------------- self-test

/**
 * Each entry mutates the valid fixture to violate exactly one rule.
 * The anchor text must be unique within the fixture.
 */
const MUTATIONS = [
  ['V001', '# Analysis: Employees', '# Employees'],
  ['V002', '## Output manifest', '## Outputs'],
  ['V003', '**Viewport:** 1440x900', '**Viewport:** big'],
  ['V003', '**Kind:** actionable\n**Type:** actions/button\n**Registry:** NEW\n**Probe:** Clicked',
    '**Knid:** actionable\n**Type:** actions/button\n**Registry:** NEW\n**Probe:** Clicked'],
  ['V004', '### E-02 — Create employee', '### E-02 Create employee'],
  ['V010', '**Locator:** `this.element.locator("th[class*=\'_nameHeader_\']")`\n**Status:** probed',
    '**Locator:** `this.element.locator("th[class*=\'_nameHeader_\']")`\n**Status:** pending'],
  ['V011', '**Probe:** Clicked "Cancel"', '**Probe:** Observed'],
  // required-verb: typing is the only action that exercises a search input; a click is not
  ['V011', '**Probe:** Typed "Rivera"', '**Probe:** Clicked "Rivera"'],
  ['V012', '**Observed:** table filtered live from 84 to 3 rows; a clear icon appeared inside the field; count label updated',
    '**Observed:** works'],
  ['V013', '**Type:** selection/single-select', '**Type:** selection/magic-widget'],
  ['V014', '**Status:** static-confirmed', '**Status:** probed'],
  // the class representative stops being probed, so nothing in the class was ever observed
  ['V017', '**Locator:** `this.element.locator("[data-aid=\'active-filter-group\']")`\n**Status:** probed',
    '**Locator:** `this.element.locator("[data-aid=\'active-filter-group\']")`\n**Status:** blocked-flaky'],
  ['V018', '**Class-ref:** E-08', '**Class-ref:** E-77'],
  // Read on a family whose behaviour only exists at interaction time
  ['V019', '**Type:** actions/link', '**Type:** selection/single-select'],
  ['V020', '### E-03 — Team filter\n**Region:** R-02', '### E-03 — Team filter\n**Region:** R-99'],
  ['V021', '**Contains:** E-03, E-04, E-07, E-08, E-15', '**Contains:** E-03, E-04, E-07, E-08, E-15, E-77'],
  ['V022', '**Reveals:** C-01', '**Reveals:** C-99'],
  ['V023', '(C-01, R-04, opened by E-02)', '(R-04, opened by E-02)'],
  ['V024', '**Affects:** E-11', '**Affects:** E-88'],
  ['V025', '**Contains:** E-05, E-06, E-16', '**Contains:** E-05, E-16'],
  ['V030', '**Reveals:** C-01\n', ''],
  ['V031', '**Reveals:** C-02, E-16\n', ''],
  ['V040', '**Locator:** `this.element.locator("[data-aid=\'role-select\']")`',
    '**Locator:** `document.querySelector("[data-aid=\'role-select\']")`'],
  ['V041', '**Locator:** `this.element.locator("input[class*=\'_gradeInput_\']")`',
    '**Locator:** `this.element.locator(page.url())`'],
  ['V043', '**Resolves:** 24', '**Resolves:** several'],
  ['V044', "**Selector:** `button[class*='_clear_']`\n**Resolves:** 1",
    "**Selector:** `button[class*='_clear_']`\n**Resolves:** 0"],
  ['V045', "**Selector:** `th[class*='_nameHeader_']`\n**Resolves:** 1",
    "**Selector:** `th[class*='_nameHeader_']`\n**Resolves:** 2"],
  ['V046', '### E-16 — Grade field\n**Region:** R-04\n**Scope:** R-04',
    '### E-16 — Grade field\n**Region:** R-04\n**Scope:** R-99'],
  // the row scoped inside itself
  ['V047', '### E-10 — Employee row\n**Region:** R-03\n**Scope:** R-03',
    '### E-10 — Employee row\n**Region:** R-03\n**Scope:** E-10'],
  // scoped inside a leaf control rather than a container
  ['V048', '### E-07 — Clear search icon\n**Region:** R-02\n**Scope:** R-02',
    '### E-07 — Clear search icon\n**Region:** R-02\n**Scope:** E-04'],
  ['V049', '**Probe:** Typed "Rivera"\n**Value-source:** page-data', '**Probe:** Typed "Rivera"'],
  ['V050', '| src/components/CreateEmployeeDialog.ts | CreateEmployeeDialog | component | planned |\n', ''],
  ['V051', '**Contains:** E-17', '**Contains:** '],
  ['V052', '(R-02)', '(no region)'],
  // V060 only applies once the run claims to have emitted code.
  ['V060', '**Phase:** classified', '**Phase:** generated', 'generated'],
  // an element declared gone while the page still has it
  ['V061', "**Selector:** `[data-testid='export']`\n**Resolves:** 0",
    "**Selector:** `[data-testid='export']`\n**Resolves:** 1"],
  ['V071', '**Box:** 24,84,320,40', '**Box:** 24,84,320'],
  // recognized without a registry class to back it
  ['V080', '**Registry:** TeamSelect', '**Registry:** NEW'],
  ['V081', '**Open-path:** click E-02 (create employee button)\n', ''],
];

/**
 * The canonical list in catalog/index.md and the `## <type>` entries in the family
 * files must stay in step. Drift here means an element can carry a type that has no
 * probe procedure, or a documented procedure nobody can reference.
 */
function catalogSelfCheck() {
  const declared = loadCatalogTypes();
  if (!declared) {
    console.log('FAIL  catalog: could not read the canonical type list');
    return 1;
  }
  const dir = dirname(CATALOG_INDEX);
  const documented = new Set();
  for (const f of readdirSync(dir)) {
    if (f === 'index.md' || !f.endsWith('.md')) continue;
    const txt = readFileSync(join(dir, f), 'utf8');
    for (const m of txt.matchAll(/^## ([a-z][a-z0-9]*\/[a-z0-9][a-z0-9-]*)\s*$/gm)) documented.add(m[1]);
  }
  const missing = [...declared].filter((t) => !documented.has(t) && !t.startsWith('other/'));
  const extra = [...documented].filter((t) => !declared.has(t));
  if (missing.length) console.log(`FAIL  catalog: declared but undocumented: ${missing.join(', ')}`);
  if (extra.length) console.log(`FAIL  catalog: documented but not declared: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) {
    console.log(`ok    catalog index and family files agree (${declared.size} types)`);
    return 0;
  }
  return 1;
}

function selfTest() {
  const src = join(FIXTURES, 'valid', 'analysis.md');
  if (!existsSync(src)) {
    console.error(`self-test: missing fixture ${src}`);
    return 1;
  }
  const base = readFileSync(src, 'utf8');
  let failed = catalogSelfCheck();

  const clean = validateContent(base, { phase: 'classified' });
  if (clean.errors.length) {
    failed++;
    console.log('FAIL  valid fixture produced errors:');
    console.log(report(clean, 'analysis.md').split('\n').map((l) => `      ${l}`).join('\n'));
  } else {
    console.log(`ok    valid fixture is clean (${clean.warnings.length} warnings)`);
  }

  for (const [rule, find, replace, phase] of MUTATIONS) {
    if (!base.includes(find)) {
      failed++;
      console.log(`FAIL  ${rule}: mutation anchor not found in fixture: ${JSON.stringify(find.slice(0, 50))}`);
      continue;
    }
    if (base.indexOf(find) !== base.lastIndexOf(find)) {
      failed++;
      console.log(`FAIL  ${rule}: mutation anchor is not unique: ${JSON.stringify(find.slice(0, 50))}`);
      continue;
    }
    const mutated = base.replace(find, replace);
    const res = validateContent(mutated, { phase: phase || 'classified' });
    const fired = res.errors.some((e) => e.rule === rule);
    if (fired) {
      console.log(`ok    ${rule} fires when violated`);
    } else {
      failed++;
      console.log(`FAIL  ${rule} did not fire. Errors seen: ${
        [...new Set(res.errors.map((e) => e.rule))].join(', ') || 'none'}`);
    }
  }

  console.log(failed ? `\n${failed} self-test failure(s)` : '\nall self-tests passed');
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------- cli

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  const json = args.includes('--json');
  const phaseArg = args.find((a) => a.startsWith('--phase='))?.slice(8);
  const target = args.find((a) => !a.startsWith('--'));

  if (!target) {
    console.error('usage: validate-analysis.mjs [--phase=<phase>] [--json] <dir-or-analysis.md>');
    console.error('       validate-analysis.mjs --self-test');
    return 1;
  }
  if (phaseArg && !PHASES.includes(phaseArg)) {
    console.error(`--phase must be one of: ${PHASES.join(', ')}`);
    return 1;
  }

  const file = target.endsWith('.md') ? resolve(target) : resolve(target, 'analysis.md');
  if (!existsSync(file)) {
    console.error(`not found: ${file}`);
    if (existsSync(dirname(file))) {
      const near = readdirSync(dirname(file)).slice(0, 20).join(', ');
      if (near) console.error(`directory contains: ${near}`);
    }
    return 1;
  }

  const result = validateContent(readFileSync(file, 'utf8'), { phase: phaseArg });
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(report(result, 'analysis.md'));

  if (result.errors.length) return 1;
  if (result.warnings.length) return 2;
  return 0;
}

process.exitCode = main(process.argv);
