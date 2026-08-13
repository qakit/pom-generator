#!/usr/bin/env node
/**
 * pom-generator — analysis artifact validator
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

import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_INDEX = resolve(HERE, '../skills/pom-generator/references/catalog/index.md');
const FIXTURES = resolve(HERE, 'fixtures');

// ---------------------------------------------------------------- constants

const PHASES = ['survey', 'decomposed', 'probed', 'classified', 'generated'];
const phaseAtLeast = (current, required) =>
  PHASES.indexOf(current) >= PHASES.indexOf(required);

const SECTIONS = ['Meta', 'Regions', 'Elements', 'Component tree', 'Output manifest'];

const META_FIELDS = ['URL', 'Slug', 'Analyzed', 'Viewport', 'Baseline', 'Phase',
  'Conventions', 'Tools-degraded', 'Notes'];
const META_REQUIRED = ['URL', 'Slug', 'Analyzed', 'Viewport', 'Baseline', 'Phase'];

const REGION_FIELDS = ['Root', 'Shot', 'Contains', 'Component', 'Notes'];
const REGION_REQUIRED = ['Root', 'Shot', 'Contains'];

const ELEMENT_FIELDS = ['Region', 'Visual', 'Snapshot-ref', 'DOM', 'Kind', 'Type', 'Status',
  'Probe', 'Observed', 'Shots', 'Reset', 'Reveals', 'Affects',
  'Registry', 'Locator', 'Locator-pw', 'Locator-agree', 'Notes'];
const ELEMENT_REQUIRED_AT = {
  survey: ['Region', 'Visual', 'Snapshot-ref', 'DOM', 'Kind', 'Type', 'Status'],
  probed: ['Probe', 'Observed'],
  classified: ['Registry', 'Locator'],
};

const DELTA_FIELDS = ['Against', 'Added', 'Removed', 'Changed', 'Unchanged'];

const ACTION_VERBS = ['Typed', 'Clicked', 'Double-clicked', 'Selected', 'Toggled', 'Checked',
  'Unchecked', 'Hovered', 'Pressed', 'Uploaded', 'Dragged', 'Scrolled',
  'Expanded', 'Collapsed'];

const KINDS = ['actionable', 'static', 'container'];
const SIMPLE_STATUSES = ['pending', 'probed', 'static-confirmed', 'removed'];

const DIALOGISH = /\b(dialog|modal|drawer|popup|popover|sheet|lightbox)\b/i;
const LISTISH = /\b(dropdown|listbox|menu|autocomplete|suggestion|typeahead|combobox list)\b/i;

const RULE_DESC = {
  V001: 'file header and version comment',
  V002: 'five sections, once each, in order',
  V003: 'field lines parse and field names are known',
  V004: 'block headers well-formed and IDs unique',
  V010: 'no element left pending',
  V011: 'actionable element must have a real probe action',
  V012: 'actionable element must have a substantive observation',
  V013: 'Type must exist in the catalog',
  V014: 'Kind and Status must agree',
  V015: 'actionable element needs before/after screenshots that exist',
  V016: 'actionable element must record how state was reset',
  V020: 'element Region must resolve',
  V021: 'region Contains must resolve',
  V022: 'Reveals must resolve',
  V023: 'revealed component must appear in the component tree',
  V024: 'Affects must resolve',
  V025: 'element/region membership must agree both ways',
  V030: 'dialog revealed but no component planned',
  V031: 'list/dropdown revealed but nothing recorded as revealed',
  V040: 'locator must be rooted at this.element or this.page',
  V041: 'locator must not reach the page from inside a component',
  V042: 'locator disagreement must state a reason',
  V050: 'component tree entry must have an output manifest row',
  V051: 'region must contain at least one element',
  V052: 'every region must be accounted for in the component tree',
  V060: 'every manifest row must be written',
  W001: 'element could not be probed',
  W002: 'hand-authored and Playwright locators disagree',
  W003: 'unmatched widget type, candidate for a new catalog entry',
  W004: 'region is large enough that it probably needs decomposing',
  W005: 'marked NEW although the same type is wrapped elsewhere',
};

// ---------------------------------------------------------------- parsing

function parse(content) {
  const lines = content.split(/\r?\n/);
  const doc = {
    lines,
    firstLine: (lines[0] || '').trim(),
    hasVersion: lines.slice(0, 4).some((l) => l.trim() === '<!-- pom-generator/analysis v1 -->'),
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
  const dir = opts.dir || '.';
  const doc = parse(content);
  const errors = [];
  const warnings = [];
  const err = (rule, line, id, msg) => errors.push({ rule, line, id, msg });
  const warn = (rule, line, id, msg) => warnings.push({ rule, line, id, msg });

  const declared = doc.meta.fields.get('Phase')?.value;
  const phase = opts.phase || (PHASES.includes(declared) ? declared : 'survey');
  const at = (p) => phaseAtLeast(phase, p);

  const fv = (o, name) => o.fields.get(name)?.value;
  const fl = (o, name) => o.fields.get(name)?.line ?? o.line;
  const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

  // ---- V001
  if (!/^# Analysis: .+/.test(doc.firstLine)) {
    err('V001', 1, '', 'first line must be "# Analysis: <name>"');
  }
  if (!doc.hasVersion) {
    err('V001', 2, '', 'missing "<!-- pom-generator/analysis v1 -->" in the first lines');
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

  for (const r of doc.regions) {
    for (const name of REGION_REQUIRED) {
      if (!r.fields.has(name)) err('V003', r.line, r.id, `missing required field "${name}"`);
    }
  }

  const catalog = loadCatalogTypes();

  for (const e of doc.elements) {
    const required = [...ELEMENT_REQUIRED_AT.survey];
    if (at('probed')) required.push(...ELEMENT_REQUIRED_AT.probed);
    if (at('classified')) required.push(...ELEMENT_REQUIRED_AT.classified);
    const kind = fv(e, 'Kind');
    const status = fv(e, 'Status');
    const isActionable = kind === 'actionable';
    const isTerminal = status && status !== 'pending';

    for (const name of required) {
      // probe-stage fields are only meaningful for elements that reached a terminal state
      if (ELEMENT_REQUIRED_AT.probed.includes(name)) {
        if (!isActionable || status === 'removed' || (status || '').startsWith('blocked-')) continue;
      }
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
      // other/text-label and friends are legitimate catalog entries; only a genuine
      // fallback is worth surfacing as a possible missing catalog entry.
      if (type === 'other/unknown' || (type.startsWith('other/') && catalog && !catalog.has(type))) {
        warn('W003', fl(e, 'Type'), e.id, `unmatched type "${type}" — candidate for a catalog entry`);
      }
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

    const probeReady = at('probed') && isActionable && isTerminal
      && status !== 'removed' && !(status || '').startsWith('blocked-');

    // ---- V011 / V012 / V015 / V016
    if (probeReady) {
      const probe = fv(e, 'Probe') || '';
      const verb = probe.split(/[\s"]/)[0];
      if (!ACTION_VERBS.includes(verb)) {
        err('V011', fl(e, 'Probe'), e.id,
          probe.trim() ? `"${probe.slice(0, 40)}" does not start with an action verb` : 'empty Probe');
      }
      const observed = fv(e, 'Observed') || '';
      if (observed.length < 20) {
        err('V012', fl(e, 'Observed'), e.id,
          `observation too thin to be a real result (${observed.length} chars)`);
      }
      const shots = list(fv(e, 'Shots'));
      if (shots.length < 2) {
        err('V015', fl(e, 'Shots'), e.id, 'needs a before and an after screenshot');
      } else {
        for (const s of shots) {
          const p = isAbsolute(s) ? s : join(dir, s);
          if (!existsSync(p)) err('V015', fl(e, 'Shots'), e.id, `screenshot not found: ${s}`);
        }
      }
      if (!(fv(e, 'Reset') || '').trim()) {
        err('V016', fl(e, 'Reset'), e.id, 'must record how baseline state was restored');
      }

      // ---- V030 / V031
      const reveals = list(fv(e, 'Reveals'));
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
    if (at('decomposed')) {
      for (const r of list(fv(e, 'Reveals'))) {
        const known = elementById.has(r) || regionById.has(r) || componentIds.has(r);
        if (!known) err('V022', fl(e, 'Reveals'), e.id, `Reveals "${r}" does not resolve`);
        else if (r.startsWith('C-') && !treeText.includes(r)) {
          err('V023', fl(e, 'Reveals'), e.id, `${r} is revealed but absent from the component tree`);
        }
      }
    }

    // ---- V040 / V041 / V042
    if (at('classified')) {
      const loc = fv(e, 'Locator');
      if (loc !== undefined) {
        const inner = loc.replace(/^`|`$/g, '').trim();
        if (!/^this\.(element|page)\b/.test(inner)) {
          err('V040', fl(e, 'Locator'), e.id, 'must start with this.element or this.page');
        }
        if (/(?<!this\.)\bpage\./.test(inner)) {
          err('V041', fl(e, 'Locator'), e.id, 'reaches the page from inside a component');
        }
      }
      const agree = fv(e, 'Locator-agree');
      if (agree !== undefined && /^no\b/.test(agree)) {
        if (!/\s[—–-]\s\S/.test(agree)) {
          err('V042', fl(e, 'Locator-agree'), e.id, 'disagreement must be followed by " — <reason>"');
        }
        warn('W002', fl(e, 'Locator-agree'), e.id, agree.slice(0, 60));
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
  if (at('decomposed')) {
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
  ['V003', '**Kind:** actionable\n**Type:** actions/button', '**Knid:** actionable\n**Type:** actions/button'],
  ['V004', '### E-03 — Create employee', '### E-03 Create employee'],
  ['V010', '**Locator-agree:** no — project convention is data-aid first\n**Status:** probed',
    '**Locator-agree:** no — project convention is data-aid first\n**Status:** pending'],
  ['V011', '**Probe:** Selected "Active"', '**Probe:** Observed'],
  ['V012', '**Observed:** listbox opened with 4 options; GET /api/employees?status=active fired; table went 84 -> 31 rows',
    '**Observed:** works'],
  ['V013', '**Type:** selection/single-select', '**Type:** selection/magic-widget'],
  ['V014', '**Status:** static-confirmed', '**Status:** probed'],
  ['V015', './screens/E-02-after.png', './screens/nope.png'],
  ['V016', '**Reset:** re-selected "All statuses", confirmed 84 rows', '**Reset:** '],
  ['V020', '**Region:** R-02\n**Visual:** pill-shaped', '**Region:** R-99\n**Visual:** pill-shaped'],
  ['V021', '**Contains:** E-02, E-03', '**Contains:** E-02, E-03, E-77'],
  ['V022', '**Reveals:** C-02', '**Reveals:** C-99'],
  ['V023', '(C-01, R-04, opened by E-03)', '(R-04, opened by E-03)'],
  ['V024', '**Affects:** E-04\n**Reset:** re-selected', '**Affects:** E-88\n**Reset:** re-selected'],
  ['V025', '**Contains:** E-02, E-03', '**Contains:** E-02'],
  ['V030', '**Reveals:** C-01\n**Affects:** E-04', '**Affects:** E-04'],
  ['V031', '**Reveals:** C-02\n**Affects:** E-04', '**Affects:** E-04'],
  ['V040', '**Locator:** `this.element.locator("[data-aid=\'create\']")`',
    '**Locator:** `document.querySelector("[data-aid=\'create\']")`'],
  ['V041', '**Locator:** `this.element.locator("[data-aid=\'create\']")`',
    '**Locator:** `this.element.locator(page.url())`'],
  ['V042', '**Locator-agree:** no — project convention is data-aid first', '**Locator-agree:** no'],
  ['V050', '| src/components/CreateEmployeeDialog.ts | CreateEmployeeDialog | component | planned |\n', ''],
  ['V051', '**Contains:** E-04', '**Contains:** '],
  ['V052', '(R-02)', '(no region)'],
  // V060 only applies once the run claims to have emitted code.
  ['V060', '**Phase:** classified', '**Phase:** generated', 'generated'],
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

/**
 * V015 checks that the screenshots an artifact references exist on disk, so the valid
 * fixture needs its `screens/` files present to validate clean. Rather than committing
 * a pile of empty .png placeholders, build a throwaway copy of the fixture in a temp
 * directory with the referenced files created on the fly. The repo keeps one file.
 */
function materializeFixture() {
  const src = join(FIXTURES, 'valid', 'analysis.md');
  if (!existsSync(src)) return null;
  const content = readFileSync(src, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'pom-selftest-'));
  mkdirSync(join(dir, 'screens'), { recursive: true });
  for (const m of content.matchAll(/\.\/screens\/([A-Za-z0-9._-]+)/g)) {
    writeFileSync(join(dir, 'screens', m[1]), '');
  }
  writeFileSync(join(dir, 'analysis.md'), content);
  return { dir, content };
}

function selfTest() {
  const fixture = materializeFixture();
  if (!fixture) {
    console.error(`self-test: missing fixture ${join(FIXTURES, 'valid', 'analysis.md')}`);
    return 1;
  }
  const { dir, content: base } = fixture;
  let failed = catalogSelfCheck();

  const clean = validateContent(base, { dir, phase: 'classified' });
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
    const res = validateContent(mutated, { dir, phase: phase || 'classified' });
    const fired = res.errors.some((e) => e.rule === rule);
    if (fired) {
      console.log(`ok    ${rule} fires when violated`);
    } else {
      failed++;
      console.log(`FAIL  ${rule} did not fire. Errors seen: ${
        [...new Set(res.errors.map((e) => e.rule))].join(', ') || 'none'}`);
    }
  }

  rmSync(dir, { recursive: true, force: true });

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

  const result = validateContent(readFileSync(file, 'utf8'), { dir: dirname(file), phase: phaseArg });
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(report(result, 'analysis.md'));

  if (result.errors.length) return 1;
  if (result.warnings.length) return 2;
  return 0;
}

process.exitCode = main(process.argv);
