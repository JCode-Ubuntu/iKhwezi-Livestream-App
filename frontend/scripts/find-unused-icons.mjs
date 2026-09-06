// One-shot audit: find imported-but-unused lucide icons per file.
// Usage: node scripts/find-unused-icons.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) { if (entry !== 'legacy') walk(p); }
    else if (/\.(jsx?|mjs)$/.test(entry)) scan(p);
  }
}

function scan(file) {
  // Exclude this script — placeholders would self-report.
  const src = readFileSync(file, 'utf8');
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => {
        const as = s.match(/^(\w+)\s+as\s+(\w+)$/);
        return as ? { orig: as[1], local: as[2] } : { orig: s, local: s };
      });
    const unused = names.filter(({ local }) => {
      const use = new RegExp(`\\b${local}\\b`, 'g');
      const count = [...src.matchAll(use)].length;
      return count <= 1; // only the import itself
    });
    if (unused.length) {
      findings.push({ file: relative(root, file), unused: unused.map((u) => u.orig) });
    }
  }
}

walk(root);
if (!findings.length) console.log('No unused lucide imports.');
else {
  for (const f of findings) console.log(`${f.file}: ${f.unused.join(', ')}`);
  console.log(`\n${findings.length} file(s) with unused icons.`);
}
