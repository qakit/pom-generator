#!/usr/bin/env node
/**
 * pom-generator — generated-code verifier
 *
 * Cross-checks generated Page Object files against the analysis artifact that specified them.
 * The artifact is a closed world: every selector in the code must have been grounded there.
 * A selector that appears in code but nowhere in the artifact was invented — it describes
 * nothing that was ever observed on the page.
 *
 * This is a static gate that runs before the live verify pass (generate/verify.md). It cannot
 * prove a selector matches the right element; it proves the code makes no claims the analysis
 * never made, and catches the defects that survive a compile: unbalanced quotes inside selector
 * strings, and Promise-valued Playwright calls used as plain values.
 *
 * Zero dependencies. Node 18+.
 *
 *   node verify-generated.mjs <analysis-dir-or-md> <generated-file...>
 *   node verify-generated.mjs <analysis-dir-or-md>          # files taken from the manifest
 *   node verify-generated.mjs --self-test
 *
 * Exit: 0 clean · 1 errors · 2 warnings only.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------- rules

const RULE_DESC = {
  G001: 'selector string is malformed',
  G002: 'selector does not appear in the analysis artifact',
  G003: 'Promise-returning call used as a plain value',
  G008: 'parameterised selector whose static part is not grounded',
  G010: 'manifest row was never advanced past "planned"',
  G011: 'manifest file does not exist on disk',
};

// Methods whose first string argument is a selector to ground against the artifact.
const SELECTOR_CALLS = /\.(?:locator|querySelector(?:All)?)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
// Test-id lookups: the id must appear somewhere in the artifact text.
const TESTID_CALLS = /\.getByTestId\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
// Playwright calls that return promises and are meaningless without await.
const PROMISE_CALLS = /\.(?:count|isVisible|isEnabled|isChecked|isDisabled|textContent|innerText|inputValue|getAttribute|boundingBox|allTextContents)\(\)/;
const COMPARISONISH = /(?:[><]=?|===?|!==?|\?\s|&&|\|\|)/;

// ---------------------------------------------------------------- artifact

const norm = (s) => s.replace(/["'`]/g, '"').replace(/\s+/g, '');

/** Every string the artifact grounded: backticked field values plus locator() args inside them. */
function groundedStrings(artifact) {
  const out = new Set();
  for (const m of artifact.matchAll(/^\*\*(?:Selector|Locator|Root|DOM|Open-path):\*\*\s*`([^`]+)`/gm)) {
    const v = m[1].trim();
    out.add(norm(v));
    for (const a of v.matchAll(/\.locator\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) out.add(norm(a[2]));
  }
  return out;
}

// ---------------------------------------------------------------- checking

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkFile(name, code, grounded, artifactText, findings) {
  const err = (rule, line, msg) => findings.errors.push({ rule, file: name, line, msg });
  const warn = (rule, line, msg) => findings.warnings.push({ rule, file: name, line, msg });

  for (const m of code.matchAll(SELECTOR_CALLS)) {
    const raw = m[2];
    const line = lineOf(code, m.index);

    // G001 — a selector whose quotes don't pair is broken before it ever runs. The classic
    // emitted form: [class*='_modal_] — the closing quote lost in transcription.
    const singles = (raw.match(/'/g) || []).length;
    const doubles = (raw.match(/(?<!\\)"/g) || []).length;
    const opens = (raw.match(/\[/g) || []).length;
    const closes = (raw.match(/\]/g) || []).length;
    if (singles % 2 !== 0 || doubles % 2 !== 0 || opens !== closes) {
      err('G001', line, `"${raw.slice(0, 60)}" has unbalanced quotes or brackets`);
      continue;
    }

    // G002 / G008 — the closed world. A selector the analysis never grounded is a claim about
    // the page that nobody checked against the page.
    const isTemplate = /\$\{/.test(raw);
    const stat = isTemplate ? raw.replace(/\$\{[^}]*\}/g, '') : raw;
    if (norm(stat).length < 3) continue; // nothing static left to check
    const n = norm(stat);
    const hit = [...grounded].some((g) => g.includes(n) || n.includes(g));
    if (!hit) {
      if (isTemplate) {
        warn('G008', line,
          `"${raw.slice(0, 60)}" — the static part was never grounded in the analysis`);
      } else {
        err('G002', line,
          `"${raw.slice(0, 60)}" appears in no Selector:/Locator:/Root: of the artifact — `
          + 'it was invented, not observed. If the wrapper needs it, the analysis has a gap');
      }
    }
  }

  for (const m of code.matchAll(TESTID_CALLS)) {
    const line = lineOf(code, m.index);
    if (!artifactText.includes(m[2])) {
      err('G002', line, `getByTestId("${m[2]}") — this id appears nowhere in the artifact`);
    }
  }

  // G003 — `x.count() > 0` compiles in JS and is always truthy-nonsense: the Promise, not the
  // number, is what gets compared. TS flags it only when the config is strict enough.
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (PROMISE_CALLS.test(l) && COMPARISONISH.test(l) && !/\bawait\b/.test(l)) {
      err('G003', i + 1,
        `"${l.trim().slice(0, 70)}" — this call returns a Promise; comparing or branching on it `
        + 'without await is always wrong');
    }
  }
}

function checkManifest(artifact, cwd, findings, providedFiles) {
  const rows = [];
  for (const line of artifact.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length === 4 && !/^-+$/.test(cells[0]) && cells[0] !== 'File') {
      rows.push({ file: cells[0], status: cells[3] });
    }
  }
  const anyOnDisk = rows.some((r) => existsSync(resolve(cwd, r.file)));
  for (const r of rows) {
    if (r.status === 'skipped-reuse') continue;
    const onDisk = existsSync(resolve(cwd, r.file));
    if (onDisk && r.status === 'planned') {
      findings.warnings.push({ rule: 'G010', file: r.file, line: 0,
        msg: 'file exists but the manifest still says "planned" — the verify pass never ran' });
    }
    if (!onDisk && anyOnDisk && ['written', 'verified'].includes(r.status)) {
      findings.errors.push({ rule: 'G011', file: r.file, line: 0,
        msg: `manifest says "${r.status}" but the file is not on disk` });
    }
  }
  // Only meaningful when run from the project root; if nothing resolves, say so once.
  if (rows.length && !anyOnDisk && !providedFiles) {
    findings.warnings.push({ rule: 'G011', file: '(manifest)', line: 0,
      msg: 'no manifest file resolves from the current directory — run from the project root' });
  }
  return rows;
}

function verify(artifactText, files /* [{name, code}] */, cwd, providedFiles) {
  const findings = { errors: [], warnings: [] };
  const grounded = groundedStrings(artifactText);
  for (const f of files) checkFile(f.name, f.code, grounded, artifactText, findings);
  if (cwd !== null) checkManifest(artifactText, cwd, findings, providedFiles);
  return findings;
}

// ---------------------------------------------------------------- reporting

function report(findings) {
  const groups = new Map();
  for (const e of [...findings.errors, ...findings.warnings]) {
    if (!groups.has(e.rule)) groups.set(e.rule, []);
    groups.get(e.rule).push(e);
  }
  const out = [];
  for (const rule of [...groups.keys()].sort()) {
    const items = groups.get(rule);
    const kind = rule.startsWith('G0') && findings.errors.includes(items[0]) ? 'error' : 'finding';
    out.push(`${rule}  ${RULE_DESC[rule] || ''}`.padEnd(66)
      + `${items.length} ${kind}${items.length === 1 ? '' : 's'}`);
    for (const i of items) out.push(`  ${i.file}${i.line ? `:${i.line}` : ''}  ${i.msg}`);
    out.push('');
  }
  const e = findings.errors.length;
  const w = findings.warnings.length;
  out.push(`${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'}`);
  if (e > 0) {
    out.push('');
    out.push('A G002 is fixed in the ANALYSIS, not by deleting the getter: if the wrapper needs');
    out.push('that element, re-run /pom-analyze so it gets observed, grounded and recorded.');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- self-test

const TEST_ARTIFACT = `# Analysis: T
<!-- pom-generator/analysis v2 -->
## Meta
**URL:** https://x/y
## Elements
### E-01 — Search
**Selector:** \`[data-aid='search-input']\`
**Locator:** \`this.element.locator("[data-aid='search-input']")\`
### E-02 — Row
**Selector:** \`tbody tr\`
**Locator:** \`this.element.locator("tbody tr")\`
## Output manifest
| File | Class | Kind | Status |
|---|---|---|---|
| src/T.ts | T | page | planned |
`;

const TEST_CASES = [
  ['clean', 'get a() { return this.element.locator("[data-aid=\'search-input\']"); }', []],
  ['clean-scoped', 'get r() { return this.element.locator("tbody tr"); }', []],
  ['invented', 'get t() { return this.element.locator("h3:has-text(\'Создать\')"); }', ['G002']],
  ['broken-quote', 'get m() { return this.page.locator("[class*=\'_modal_]"); }', ['G001']],
  ['promise', 'const n = item.locator("tbody tr").count() > 0 ? a : b;', ['G003']],
  ['awaited-ok', 'const n = await item.locator("tbody tr").count() > 0 ? 1 : 2;', []],
  ['template', 'get x() { return this.element.locator(`div:has-text(\'${name}\')`); }', ['G008']],
  ['testid-bad', 'get z() { return this.page.getByTestId("phantom-id"); }', ['G002']],
];

function selfTest() {
  let failed = 0;
  for (const [name, code, expected] of TEST_CASES) {
    const f = verify(TEST_ARTIFACT, [{ name: `${name}.ts`, code }], null, true);
    const fired = [...new Set([...f.errors, ...f.warnings].map((x) => x.rule))].sort();
    const want = [...expected].sort();
    if (JSON.stringify(fired) === JSON.stringify(want)) {
      console.log(`ok    ${name} -> ${want.join(',') || 'clean'}`);
    } else {
      failed++;
      console.log(`FAIL  ${name}: expected [${want}] got [${fired}]`);
    }
  }
  console.log(failed ? `\n${failed} self-test failure(s)` : '\nall self-tests passed');
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------- cli

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  const paths = args.filter((a) => !a.startsWith('--'));
  if (!paths.length) {
    console.error('usage: verify-generated.mjs <analysis-dir-or-md> [generated-file...]');
    console.error('       verify-generated.mjs --self-test');
    return 1;
  }
  const artifactPath = paths[0].endsWith('.md')
    ? resolve(paths[0]) : resolve(paths[0], 'analysis.md');
  if (!existsSync(artifactPath)) {
    console.error(`not found: ${artifactPath}`);
    return 1;
  }
  const artifactText = readFileSync(artifactPath, 'utf8');

  let fileArgs = paths.slice(1);
  const provided = fileArgs.length > 0;
  if (!provided) {
    // derive from the manifest, keeping only files that exist
    for (const line of artifactText.split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length === 4 && !/^-+$/.test(cells[0]) && cells[0] !== 'File'
          && existsSync(resolve(cells[0]))) {
        fileArgs.push(cells[0]);
      }
    }
  }
  const files = fileArgs.map((p) => ({ name: p, code: readFileSync(resolve(p), 'utf8') }));
  const findings = verify(artifactText, files, process.cwd(), provided);
  console.log(report(findings));
  console.log(`\nchecked ${files.length} file(s) against ${artifactPath}`);

  if (findings.errors.length) return 1;
  if (findings.warnings.length) return 2;
  return 0;
}

process.exitCode = main(process.argv);
