const fs = require('fs');
const { execSync } = require('child_process');

// Run lint and capture output
const lintOutput = execSync('npm run lint 2>&1 || true', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

// Parse warnings
const warnings = []; // { file, line, col, name, type }
let currentFile = null;

for (const rawLine of lintOutput.split('\n')) {
  const line = rawLine.replace(/\u001b\[[0-9;]*m/g, ''); // strip ANSI
  
  const fileMatch = line.match(/^(\/[^:]+?\.(?:js|ts|jsx|tsx))$/);
  if (fileMatch) { currentFile = fileMatch[1]; continue; }
  if (!currentFile) continue;

  let m;

  m = line.match(/^\s+(\d+):(\d+)\s+warning\s+'([^']+)'(?: is defined but never used| is assigned a value but never used)/);
  if (m) { warnings.push({ file: currentFile, line: +m[1], col: +m[2], name: m[3], type: 'unused' }); continue; }

  m = line.match(/^\s+(\d+):(\d+)\s+warning\s+Empty block statement/);
  if (m) { warnings.push({ file: currentFile, line: +m[1], col: +m[2], type: 'no-empty' }); continue; }

  m = line.match(/^\s+(\d+):(\d+)\s+warning\s+Unexpected lexical declaration in case block/);
  if (m) { warnings.push({ file: currentFile, line: +m[1], col: +m[2], type: 'no-case-decl' }); continue; }

  m = line.match(/^\s+(\d+):(\d+)\s+warning\s+Unnecessary semicolon/);
  if (m) { warnings.push({ file: currentFile, line: +m[1], col: +m[2], type: 'no-extra-semi' }); continue; }
}

// Group by file
const byFile = {};
for (const w of warnings) {
  if (!byFile[w.file]) byFile[w.file] = [];
  byFile[w.file].push(w);
}

console.log(`Parsed ${warnings.length} warnings across ${Object.keys(byFile).length} files.`);

let totalFixed = 0;

for (const [file, fwarns] of Object.entries(byFile)) {
  let content = fs.readFileSync(file, 'utf8');
  const origContent = content;

  // Process bottom-up to avoid line shifts
  const sorted = [...fwarns].sort((a, b) => b.line - a.line || b.col - a.col);

  for (const w of sorted) {
    const lines = content.split('\n');
    const idx = w.line - 1;
    const line = lines[idx];
    if (!line) continue;

    if (w.type === 'no-extra-semi') {
      const n = line.replace(/;\s*$/, '');
      if (n !== line) { lines[idx] = n; content = lines.join('\n'); totalFixed++; }
      continue;
    }

    if (w.type === 'no-empty') {
      const n = line.replace(/\{\s*\}/, '{ /* empty */ }');
      if (n !== line) { lines[idx] = n; content = lines.join('\n'); totalFixed++; }
      continue;
    }

    if (w.type === 'no-case-decl') {
      const indent = line.match(/^\s*/)[0];
      lines[idx] = indent + '{';
      lines.splice(idx + 1, 0, indent + '}');
      content = lines.join('\n');
      totalFixed++;
      continue;
    }

    if (w.type === 'unused') {
      const trimmed = line.trim();

      if (trimmed.startsWith('import ')) {
        // Parse import specifiers
        const importRe = /^(\s*)import\s+(.+?)\s+from\s+(['"])([^'"]+)\3;?\s*$/;
        const im = line.match(importRe);
        if (!im) continue; // skip complex/multi-line imports

        const indent = im[1];
        const specPart = im[2];
        const fromPart = im[4];

        // Split specifiers: default + named
        let defaultSpec = null;
        let namedSpecs = [];

        // Handle "default, { named1, named2 }" or "default" or "{ named1, named2 }"
        const namedMatch = specPart.match(/\{\s*([^}]+)\s*\}/);
        if (namedMatch) {
          namedSpecs = namedMatch[1].split(',').map(s => s.trim());
        }

        const beforeBraces = specPart.split('{')[0].trim();
        if (beforeBraces && beforeBraces !== ',') {
          defaultSpec = beforeBraces.replace(/,?\s*$/, '').trim();
        }

        let newLine = null;

        if (defaultSpec === w.name && namedSpecs.length === 0) {
          newLine = ''; // remove entire line
        } else if (defaultSpec === w.name) {
          newLine = `${indent}import { ${namedSpecs.join(', ')} } from '${fromPart}';`;
        } else if (namedSpecs.includes(w.name)) {
          const filtered = namedSpecs.filter(s => s !== w.name);
          if (filtered.length === 0) {
            if (defaultSpec) {
              newLine = `${indent}import ${defaultSpec} from '${fromPart}';`;
            } else {
              newLine = '';
            }
          } else if (defaultSpec) {
            newLine = `${indent}import ${defaultSpec}, { ${filtered.join(', ')} } from '${fromPart}';`;
          } else {
            newLine = `${indent}import { ${filtered.join(', ')} } from '${fromPart}';`;
          }
        }

        if (newLine !== null) {
          const curLines = content.split('\n');
          curLines[idx] = newLine;
          content = curLines.join('\n');
          totalFixed++;
        }
      } else {
        // Non-import: prefix variable with _
        // Only replace at the exact word position
        const before = line.slice(0, w.col - 1);
        const after = line.slice(w.col - 1);
        const nameRe = new RegExp(`^\\b${w.name}\\b`);
        if (nameRe.test(after)) {
          const curLines = content.split('\n');
          curLines[idx] = before + '_' + after;
          content = curLines.join('\n');
          totalFixed++;
        }
      }
    }
  }

  if (content !== origContent) {
    fs.writeFileSync(file, content);
  }
}

console.log(`Fixed ${totalFixed} warnings.`);

// Count remaining
const remaining = execSync('npm run lint 2>&1 || true', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const remainingWarnings = (remaining.match(/warning/g) || []).length;
console.log(`Remaining warnings: ${remainingWarnings}`);

if (remainingWarnings > 0) {
  console.log('\n--- Remaining warnings ---');
  remaining.split('\n').filter(l => l.includes('warning')).forEach(l => console.log(l.replace(/\u001b\[[0-9;]*m/g, '')));
}
