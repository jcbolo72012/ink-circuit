/* Bundle index.html and its modules into one file that runs from anywhere.
 *
 * Splitting into modules is right for the project — the server, the tests and
 * the Python port all need one canonical sim — but it means index.html can
 * only be opened over http, never by double-clicking. This inlines them so
 * there is a file you can open directly, email to someone, or drop into a
 * preview pane.
 *
 * The modules stay the single source of truth. standalone.html is a build
 * output and should never be edited by hand.
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const here = u => new URL(u, import.meta.url);

/* Dependency order, not import order. Modules import each other — audio.js
   pulls in audio-sample.js — so listing them in the order they must be
   defined is simpler and more obvious than resolving the graph. */
const MODULES = ['./sim.js', './audio-sample.js', './audio.js'];

/* Strip module syntax. Everything lands in one scope, so exports become
   plain top-level declarations and imports simply disappear — whatever they
   referred to has already been defined above. */
const flatten = src => src
  .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');

const page = readFileSync(here('./index.html'), 'utf8');

const bundle = MODULES.map(path => {
  const name = path.replace('./', '');
  const body = flatten(readFileSync(here(path), 'utf8'));
  return '/* ---- inlined from ' + name + ' ---- */\n' + body +
         '\n/* ---- end ' + name + ' ---- */\n';
}).join('\n');

/* Every import in the page is replaced: the first with the whole bundle, the
   rest with nothing. */
const IMPORT = /^\s*import\s[\s\S]*?from\s*['"]\.\/[^'"]+['"];?\s*$/gm;
if (!IMPORT.test(page)){
  console.error('index.html has no module imports — has the header changed?');
  process.exit(1);
}
IMPORT.lastIndex = 0;

let placed = false;
let out = page.replace(IMPORT, () => {
  if (placed) return '';
  placed = true;
  return bundle;
});

out = out.replace('<script type="module">', '<script>');

/* Nothing may survive. A leftover import means a file opened from disk fails
   silently with a blank page, which is exactly the bug this guards against. */
const leftover = out.match(/^\s*import\s.*from\s*['"].*['"]/m);
if (leftover){
  console.error('An import survived the bundle step: ' + leftover[0].trim());
  process.exit(1);
}
if (out.includes('type="module"')){
  console.error('A module script survived the bundle step.');
  process.exit(1);
}
/* Catch a module listed out of order: a name used before its definition. */
for (const path of MODULES){
  const name = path.replace('./', '');
  if (!out.includes('inlined from ' + name)){
    console.error(name + ' was not inlined.');
    process.exit(1);
  }
}

writeFileSync(here('./standalone.html'), out);

const kb = n => (n/1024).toFixed(1) + 'kb';
console.log('standalone.html written  ' + kb(out.length) +
            '  (page ' + kb(page.length) + ' + ' + MODULES.length + ' modules)');
