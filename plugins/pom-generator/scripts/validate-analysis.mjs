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
  'Conventions', 'Tools-degraded', 'Budget', 'Spent', 'Notes'];
const META_REQUIRED = ['URL', 'Slug', 'Analyzed', 'Viewport', 'Baseline', 'Phase'];

const REGION_FIELDS = ['Root', 'Resolves', 'Box', 'Shot', 'Contains', 'Component', 'Notes'];
const REGION_REQUIRED = ['Root', 'Resolves', 'Box', 'Shot', 'Contains'];

const ELEMENT_FIELDS = ['Region', 'Scope', 'Visual', 'Snapshot-ref', 'DOM',
  'Selector', 'Resolves', 'Box',
  'Kind', 'Type', 'Tier', 'Class', 'Class-ref', 'Status',
  'Probe', 'Observed', 'Shots', 'Reset', 'Reveals', 'Affects',
  'Registry', 'Locator', 'Locator-pw', 'Locator-agree', 'Notes'];
const ELEMENT_REQUIRED_AT = {
  survey: ['Region', 'Scope', 'Visual', 'Snapshot-ref', 'DOM', 'Selector', 'Resolves', 'Box',
    'Kind', 'Type', 'Status'],
  probed: ['Probe', 'Observed'],
  classified: ['Registry', 'Locator'],
};

const DELTA_FIELDS = ['Against', 'Added', 'Removed', 'Changed', 'Unchanged'];

const ACTION_VERBS = ['Typed', 'Clicked', 'Double-clicked', 'Selected', 'Toggled', 'Checked',
  'Unchecked', 'Hovered', 'Pressed', 'Uploaded', 'Dragged', 'Scrolled',
  'Expanded', 'Collapsed', 'Read'];

const KINDS = ['actionable', 'static', 'container'];
const SIMPLE_STATUSES = ['pending', 'probed', 'probed-by-class', 'static-confirmed', 'removed'];

/**
 * How much evidence an element's conclusion is allowed to rest on. Assigned at survey so the
 * cost of P3 is known — and approvable — before P3 starts, not discovered two hours in.
 *
 *   full      the whole probe procedure: before/after screenshots, action, reset
 *   class     one member of an equivalence class is probed `full`; the rest inherit its
 *             outcome and say so, which is declared extrapolation rather than silent
 *   evidence  no interaction — the conclusion comes from attributes the DOM already states
 *             (an `href`, `disabled`, `type`). Cheap, and strictly limited by V019
 */
const TIERS = ['full', 'class', 'evidence'];

/**
 * Families whose behaviour is never readable from attributes: what a select does depends on
 * what happens when you select, and a conditional field that appears on the third option is
 * invisible to any amount of DOM reading. `Tier: evidence` on these is the shortcut that
 * produces a confident, wrong artifact.
 */
const MUST_INTERACT = ['inputs', 'selection', 'temporal', 'collections'];

/**
 * Element screenshots come back at the browser's device pixel ratio, so a box measured in CSS
 * pixels and a file measured in device pixels differ by a whole-number scale. Accept any of
 * these, with slack for the margin some capture paths add around the element.
 */
const DEVICE_SCALES = [1, 2, 3];
const BOX_TOLERANCE = 0.08;
const BOX_SLACK_PX = 8;

/**
 * A Page Object's locators are relative to the thing that owns them, so a selector only means
 * anything together with the frame it resolves in. A cell selector matches once per row when
 * asked inside a row, and once per row *in total* when asked of the document.
 *
 * `Scope:` names that frame: `page`, a region, or a container element. It is also the subtree
 * that gets diffed when the element is probed, which is how a field that only appears after a
 * dropdown selection gets noticed instead of reasoned about.
 */
const PAGE_SCOPE = 'page';

/**
 * The root expression a locator hangs off, in whatever language the project writes. Matching on
 * the shape rather than on the literal `this.element` is what lets a Python project using
 * `self.element` or `self._root` validate at all.
 */
const ROOT_RE = /^(this|self)\.([A-Za-z_]\w*)/;

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
  V017: 'every equivalence class needs one fully probed member',
  V018: 'an inherited outcome must name the member it came from',
  V019: 'Tier must be legal for the element type',
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
  V042: 'locator disagreement must state a reason',
  V043: 'Resolves must be a match count taken from the live page',
  V044: 'selector matched nothing within its scope',
  V045: 'selector is ambiguous within its scope and nothing explains why',
  V046: 'Scope must resolve to the page, a region, or a container',
  V047: 'scope chain must reach the page without looping',
  V048: 'an element can only be scoped inside a container in its own region',
  V070: 'region screenshot must exist on disk',
  V071: 'Box must be four numbers describing a rendered element',
  V072: 'screenshot does not match the box it claims to show',
  V050: 'component tree entry must have an output manifest row',
  V051: 'region must contain at least one element',
  V052: 'every region must be accounted for in the component tree',
  V060: 'every manifest row must be written',
  W001: 'element could not be probed',
  W002: 'hand-authored and Playwright locators disagree',
  W003: 'unmatched widget type, candidate for a new catalog entry',
  W004: 'region is large enough that it probably needs decomposing',
  W005: 'marked NEW although the same type is wrapped elsewhere',
  W006: 'the run spent more than the budget approved at Gate 1',
  W007: 'the locator does not contain the selector it was grounded from',
  W008: 'region crop is too tall to read anything in',
};

// ------------------------------------------------------------------ geometry

/**
 * A PNG's dimensions live in the IHDR chunk, which is always first: 8-byte signature, then a
 * 4-byte length, "IHDR", then width and height as big-endian uint32. That is all this needs,
 * so there is no decoding and no dependency.
 *
 * Returns null for anything that is not a readable PNG — a missing or truncated file is
 * V015/V070's problem, not this one's.
 */
function pngSize(path) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** `x,y,w,h` in CSS pixels. Fractional values are normal — layout is not integral. */
function parseBox(value) {
  const parts = String(value || '').split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts;
  return { x, y, w, h };
}

/** True when `file` could plausibly be a capture of `box` at some device pixel ratio. */
function boxMatchesImage(box, img) {
  return DEVICE_SCALES.some((s) => {
    const ew = box.w * s;
    const eh = box.h * s;
    return Math.abs(img.w - ew) <= Math.max(BOX_SLACK_PX, ew * BOX_TOLERANCE)
      && Math.abs(img.h - eh) <= Math.max(BOX_SLACK_PX, eh * BOX_TOLERANCE);
  });
}

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

  /**
   * A selector is a claim about the page, and `Resolves:` is what turns it into a checkable
   * one: the count the run got back when it asked the live page how many nodes this matches.
   * Without it, a fabricated selector is indistinguishable from a real one until the generated
   * code fails — which is much later and much more expensive.
   *
   * Returns the parsed count so callers can use it.
   */
  const checkResolves = (o, selectorField) => {
    const raw = fv(o, 'Resolves');
    if (raw === undefined) return null;
    if (!/^\d+$/.test(raw.trim())) {
      err('V043', fl(o, 'Resolves'), o.id, `Resolves must be a whole match count, got "${raw}"`);
      return null;
    }
    const n = Number.parseInt(raw, 10);
    if (n === 0) {
      err('V044', fl(o, selectorField), o.id,
        `${selectorField} matched nothing — it was not taken from the page it describes`);
    }
    return n;
  };

  /** Geometry the run measured. A zero-sized box means the element never rendered. */
  const checkBox = (o) => {
    const raw = fv(o, 'Box');
    if (raw === undefined) return null;
    const box = parseBox(raw);
    if (!box) {
      err('V071', fl(o, 'Box'), o.id, `Box must be "x,y,w,h", got "${raw}"`);
      return null;
    }
    if (box.w <= 0 || box.h <= 0) {
      err('V071', fl(o, 'Box'), o.id,
        `Box is ${box.w}x${box.h} — a zero-sized element was not on screen when it was measured`);
      return null;
    }
    return box;
  };

  /**
   * The check that makes "read the screenshot" enforceable. A crop of the wrong node, or of a
   * node whose bounding box spans the whole scroll height, produces an image that does not
   * show what its caption says — and every conclusion drawn from it is then unfounded.
   */
  const checkShotGeometry = (o, shotField, path, box) => {
    if (!box) return;
    const img = pngSize(path);
    if (!img) return; // not a readable PNG; existence is V015/V070's job
    if (!boxMatchesImage(box, img)) {
      err('V072', fl(o, shotField), o.id,
        `${shotField} is ${img.w}x${img.h}px but Box says ${Math.round(box.w)}x${Math.round(box.h)} — `
        + 'the image does not show the element it is filed under');
    }
  };

  const viewportH = Number.parseInt((fv(doc.meta, 'Viewport') || '').split('x')[1], 10);

  for (const r of doc.regions) {
    for (const name of REGION_REQUIRED) {
      if (!r.fields.has(name)) err('V003', r.line, r.id, `missing required field "${name}"`);
    }
    checkResolves(r, 'Root');
    const box = checkBox(r);

    // ---- V070 / V072
    const shot = fv(r, 'Shot');
    if (shot) {
      const p = isAbsolute(shot) ? shot : join(dir, shot);
      if (!existsSync(p)) {
        err('V070', fl(r, 'Shot'), r.id, `region screenshot not found: ${shot}`);
      } else {
        checkShotGeometry(r, 'Shot', p, box);
      }
    }

    // ---- W008
    if (box && Number.isFinite(viewportH) && box.h > viewportH * 2) {
      warn('W008', fl(r, 'Box'), r.id,
        `region is ${Math.round(box.h)}px tall against a ${viewportH}px viewport — `
        + 'the crop is mostly whitespace and nothing in it is legible; decompose it');
    }
  }

  const catalog = loadCatalogTypes();

  for (const e of doc.elements) {
    const required = [...ELEMENT_REQUIRED_AT.survey];
    if (at('probed')) required.push(...ELEMENT_REQUIRED_AT.probed);
    if (at('classified')) required.push(...ELEMENT_REQUIRED_AT.classified);
    const kind = fv(e, 'Kind');
    const status = fv(e, 'Status');
    const tier = fv(e, 'Tier');
    const isActionable = kind === 'actionable';
    const isTerminal = status && status !== 'pending';
    const inherited = status === 'probed-by-class';

    // An actionable element carries a tier from survey onward: it is what the Gate 1 budget
    // is computed from, so it cannot be decided later when the cost is already sunk.
    if (isActionable && status !== 'removed') required.push('Tier');

    for (const name of required) {
      // probe-stage fields are only meaningful for elements that reached a terminal state,
      // and an inherited outcome records its source instead of an action it did not perform
      if (ELEMENT_REQUIRED_AT.probed.includes(name)) {
        if (!isActionable || inherited || status === 'removed'
            || (status || '').startsWith('blocked-')) continue;
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
        const seen = new Set([e.id]);
        let cur = scope;
        while (cur !== PAGE_SCOPE && elementById.has(cur)) {
          if (seen.has(cur)) {
            err('V047', fl(e, 'Scope'), e.id,
              `scope chain loops: ${[...seen].join(' -> ')} -> ${cur}`);
            break;
          }
          seen.add(cur);
          cur = fv(elementById.get(cur), 'Scope') ?? PAGE_SCOPE;
        }
      }
    }

    // ---- V043 / V044 / V045
    const resolves = checkResolves(e, 'Selector');
    const elBox = checkBox(e);
    // Resolves is counted *within* Scope, so >1 is a genuine collection (rows, options, cards)
    // rather than the artifact of asking a document-wide question about a component-local
    // selector. A collection is addressed by index or text at runtime, so it is expected.
    if (resolves !== null && resolves > 1
        && !fv(e, 'Class') && kind !== 'container') {
      err('V045', fl(e, 'Selector'), e.id,
        `Selector matches ${resolves} nodes inside ${scope || 'its scope'} — `
        + 'scope it deeper, or declare the group with Class:');
    }

    // ---- V019
    if (tier !== undefined) {
      if (!TIERS.includes(tier)) {
        err('V019', fl(e, 'Tier'), e.id, `Tier must be one of ${TIERS.join(', ')}`);
      } else if (tier === 'evidence') {
        const family = (type || '').split('/')[0];
        if (MUST_INTERACT.includes(family)) {
          err('V019', fl(e, 'Tier'), e.id,
            `Tier: evidence is not available for ${family}/* — its behaviour is only observable by interacting`);
        }
        if (list(fv(e, 'Reveals')).length) {
          err('V019', fl(e, 'Tier'), e.id,
            'Tier: evidence cannot reveal anything — something that opens a dialog or list must be probed');
        }
      }
      if (tier === 'class' && !fv(e, 'Class')) {
        err('V019', fl(e, 'Tier'), e.id, 'Tier: class requires a Class');
      }
    }
    if (inherited && tier !== 'class') {
      err('V018', fl(e, 'Status'), e.id, 'Status: probed-by-class is only legal at Tier: class');
    }

    // ---- V018
    if (inherited) {
      const ref = fv(e, 'Class-ref');
      const cls = fv(e, 'Class');
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

    const probeReady = at('probed') && isActionable && isTerminal && !inherited
      && status !== 'removed' && !(status || '').startsWith('blocked-');

    // ---- V011 / V012 / V015 / V016
    if (probeReady) {
      const probe = fv(e, 'Probe') || '';
      const verb = probe.split(/[\s"]/)[0];
      if (!ACTION_VERBS.includes(verb)) {
        err('V011', fl(e, 'Probe'), e.id,
          probe.trim() ? `"${probe.slice(0, 40)}" does not start with an action verb` : 'empty Probe');
      }
      // `Read` is the evidence-tier verb: it states that a conclusion came from an attribute
      // the DOM already carries. It is honest there and a dodge anywhere else.
      if (verb === 'Read' && tier !== 'evidence') {
        err('V011', fl(e, 'Probe'), e.id, '"Read" is only a probe at Tier: evidence');
      }
      const observed = fv(e, 'Observed') || '';
      if (observed.length < 20) {
        err('V012', fl(e, 'Observed'), e.id,
          `observation too thin to be a real result (${observed.length} chars)`);
      }
      // An evidence-tier element performed no action, so there is no before/after pair to
      // take and no state to put back. Everything else owes both.
      if (tier !== 'evidence') {
        const shots = list(fv(e, 'Shots'));
        if (shots.length < 2) {
          err('V015', fl(e, 'Shots'), e.id, 'needs a before and an after screenshot');
        } else {
          for (const s of shots) {
            const p = isAbsolute(s) ? s : join(dir, s);
            if (!existsSync(p)) err('V015', fl(e, 'Shots'), e.id, `screenshot not found: ${s}`);
            // the "before" shot is the element in its baseline state, so it is the one the
            // box was measured against; the "after" shot may legitimately differ in size
            else if (s === shots[0]) checkShotGeometry(e, 'Shots', p, elBox);
          }
        }
        if (!(fv(e, 'Reset') || '').trim()) {
          err('V016', fl(e, 'Reset'), e.id, 'must record how baseline state was restored');
        }
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
        if (root && /\b(?<!this\.)(?<!self\.)page\./.test(inner.slice(root[0].length))) {
          err('V041', fl(e, 'Locator'), e.id, 'reaches the page from inside a component');
        }
      }
      // ---- W007
      // `Selector:` was checked against the live page; `Locator:` is what actually gets
      // written into the wrapper. When the second stops containing the first, the grounding
      // no longer covers the thing being generated — which is exactly how a selector copied
      // out of the component registry ends up in code without ever touching the page.
      // A role- or label-based locator is a different expression of the same node, not an
      // ungrounded one — that is what Locator-pw exists to record. Only a raw selector string
      // passed to locator() makes a claim that Selector: was supposed to have checked.
      const sel = (fv(e, 'Selector') || '').replace(/^`|`$/g, '').trim();
      const locRaw = (fv(e, 'Locator') || '').replace(/^`|`$/g, '').trim();
      const norm = (s) => s.replace(/["']/g, '"').replace(/\s+/g, '');
      const args = [...locRaw.matchAll(/\.locator\(\s*(['"])([\s\S]*?)\1/g)].map((m) => m[2]);
      if (sel && args.length
          && !args.some((a) => norm(a).includes(norm(sel)) || norm(sel).includes(norm(a)))) {
        warn('W007', fl(e, 'Locator'), e.id,
          `Locator selects on ${args[0].slice(0, 30)} but Selector: grounded ${sel.slice(0, 30)}`);
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

  // ---- W006
  const budget = Number.parseInt((fv(doc.meta, 'Budget') || '').replace(/[^0-9]/g, ''), 10);
  const spent = Number.parseInt((fv(doc.meta, 'Spent') || '').replace(/[^0-9]/g, ''), 10);
  if (Number.isFinite(budget) && Number.isFinite(spent) && spent > budget) {
    warn('W006', fl(doc.meta, 'Spent'), 'Meta',
      `spent ${spent} against a budget of ${budget} approved at Gate 1`);
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
  ['V014', '**Locator-agree:** yes\n**Status:** static-confirmed',
    '**Locator-agree:** yes\n**Status:** probed'],
  ['V015', './screens/E-02-after.png', './screens/nope.png'],
  ['V016', '**Reset:** re-selected "All statuses", confirmed 84 rows', '**Reset:** '],
  // the class representative stops being probed, so nothing in the class was ever observed
  ['V017', '**Locator-pw:** `getByRole(\'option\', { name: \'Active\' })`\n**Locator-agree:** yes\n**Status:** probed',
    '**Locator-pw:** `getByRole(\'option\', { name: \'Active\' })`\n**Locator-agree:** yes\n**Status:** blocked-flaky'],
  ['V018', '**Class-ref:** E-06', '**Class-ref:** E-77'],
  ['V019', '**Type:** actions/link\n**Tier:** evidence', '**Type:** selection/single-select\n**Tier:** evidence'],
  ['V020', '**Region:** R-02\n**Scope:** R-02\n**Visual:** pill-shaped',
    '**Region:** R-99\n**Scope:** R-02\n**Visual:** pill-shaped'],
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
  ['V043', "**Selector:** `[data-aid='create']`\n**Resolves:** 1",
    "**Selector:** `[data-aid='create']`\n**Resolves:** several"],
  ['V044', "**Selector:** `[data-aid='full-name']`\n**Resolves:** 1",
    "**Selector:** `[data-aid='full-name']`\n**Resolves:** 0"],
  ['V045', "**Selector:** `button[class*='_clear_']`\n**Resolves:** 1",
    "**Selector:** `button[class*='_clear_']`\n**Resolves:** 2"],
  ['V046', '### E-05 — Full name field\n**Region:** R-04\n**Scope:** R-04',
    '### E-05 — Full name field\n**Region:** R-04\n**Scope:** R-99'],
  // the row scoped inside its own cell, which is scoped inside the row
  ['V047', '### E-10 — Employee row\n**Region:** R-03\n**Scope:** E-04',
    '### E-10 — Employee row\n**Region:** R-03\n**Scope:** E-11'],
  // scoped inside a leaf control rather than a container
  ['V048', '### E-07 — Clear full name\n**Region:** R-04\n**Scope:** R-04',
    '### E-07 — Clear full name\n**Region:** R-04\n**Scope:** E-05'],
  ['V070', '**Shot:** ./screens/R-03.png', '**Shot:** ./screens/gone.png'],
  ['V071', '**Box:** 0,72,1440,64', '**Box:** 0,72,1440'],
  // the fixture's R-04 crop is generated at 600x420; claiming a taller box makes the image
  // stop matching what it is filed under, which is the R-05-shows-the-header failure
  ['V072', '**Box:** 420,180,600,420', '**Box:** 420,180,600,900'],
  ['V050', '| src/components/CreateEmployeeDialog.ts | CreateEmployeeDialog | component | planned |\n', ''],
  ['V051', '**Contains:** E-04, E-10, E-11', '**Contains:** '],
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
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

/**
 * A PNG signature plus a well-formed IHDR chunk and nothing else. No image viewer will open
 * it, which is fine: the only consumer is `pngSize`, and what the self-test needs is a file
 * that truthfully reports a width and a height so V072 can be exercised for real rather than
 * asserted against a stub that always skips.
 */
function pngHeaderOnly(w, h) {
  const ihdr = Buffer.alloc(17);
  ihdr.write('IHDR', 0, 'latin1');
  ihdr.writeUInt32BE(w, 4);
  ihdr.writeUInt32BE(h, 8);
  ihdr[12] = 8;   // bit depth
  ihdr[13] = 6;   // colour type: RGBA
  const len = Buffer.alloc(4);
  len.writeUInt32BE(13, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(ihdr), 0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    len, ihdr, crc,
  ]);
}

/**
 * V015 and V070 check that an artifact's screenshots exist, and V072 checks that they are the
 * size their `Box:` claims. Rather than committing a pile of binary placeholders, build a
 * throwaway copy of the fixture in a temp directory with header-only PNGs generated at the
 * sizes the fixture declares. The repo keeps one file.
 */
function materializeFixture() {
  const src = join(FIXTURES, 'valid', 'analysis.md');
  if (!existsSync(src)) return null;
  const content = readFileSync(src, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'pom-selftest-'));
  mkdirSync(join(dir, 'screens'), { recursive: true });

  // map each screenshot to the box of the block that references it
  const sizes = new Map();
  for (const block of content.split(/^### /m).slice(1)) {
    const box = parseBox((block.match(/^\*\*Box:\*\* (.+)$/m) || [])[1]);
    if (!box) continue;
    // Shots lists before then after; the before shot is the one measured against the box
    const shots = (block.match(/^\*\*Shots?:\*\* (.+)$/m) || [])[1];
    if (!shots) continue;
    const first = shots.split(',')[0].trim().match(/([A-Za-z0-9._-]+)$/);
    if (first) sizes.set(first[1], box);
  }

  for (const m of content.matchAll(/\.\/screens\/([A-Za-z0-9._-]+)/g)) {
    const box = sizes.get(m[1]);
    writeFileSync(join(dir, 'screens', m[1]),
      box ? pngHeaderOnly(Math.round(box.w), Math.round(box.h)) : Buffer.alloc(0));
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
