/* Boot smoke test.
 *
 *   node test/smoke.mjs
 *
 * Loads standalone.html — the real shipped bundle — in a stubbed DOM and
 * checks it reaches the end of setup without throwing.
 *
 * This exists because `node --check` only proves a file parses, and the
 * conformance suite only exercises sim.js. Neither catches the class of bug
 * where the page parses fine and then dies on the first line of setup: a
 * const used above its declaration, a missing element, a bad import. Those
 * produce a blank page, and the only symptom is a console message nobody
 * sees until someone opens the game.
 */
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok){ pass++; console.log('  ok    ' + name + (detail ? '  ' + detail : '')); }
  else   { fail++; console.log('  FAIL  ' + name + (detail ? '  ' + detail : '')); }
};

/* A DOM stub that says yes to everything. The point is to get through setup,
   not to render — anything the page reaches for exists and does nothing. */
function installDom(search = ''){
  const noop = () => {};
  /* A canvas context that answers plausibly. The few calls whose return value
     the page actually uses have to give back something usable, or the stub
     itself becomes the thing that fails. */
  const ctx2dReal = {
    createImageData: (w, h) => ({ width: w, height: h,
      data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h,
      data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4) }),
    measureText: t => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    canvas: { width: 900, height: 520 }
  };
  const ctx2d = new Proxy(ctx2dReal, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: () => true
  });
  const made = new Map();
  const el = (id = '') => {
    const handlers = {};
    const node = {
      id, handlers, dataset: {}, hidden: false, value: '',
      style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
      textContent: '', innerHTML: '', width: 0, height: 0, className: '',
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop,
      attrs: {},
      setAttribute(k, v){ this.attrs[k] = String(v); },
      removeAttribute(k){ delete this.attrs[k]; },
      getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; },
      addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
      removeEventListener: noop,
      dispatchEvent: () => true,
      click(){ (handlers.click || []).forEach(f => f({ preventDefault: noop })); },
      focus: noop, blur: noop, select: noop, scrollIntoView: noop,
      setPointerCapture: noop, releasePointerCapture: noop,
      getContext: () => ctx2d,
      toDataURL: () => 'data:,',
      getBoundingClientRect: () => ({ left:0, top:0, right:900, bottom:520, width:900, height:520 }),
      querySelector: () => el(),
      querySelectorAll: () => [],
      closest: () => null,
      get offsetWidth(){ return 900; },
      get offsetHeight(){ return 520; }
    };
    return node;
  };

  const doc = {
    getElementById: id => { if (!made.has(id)) made.set(id, el(id)); return made.get(id); },
    createElement: () => el(),
    querySelector: () => el(),
    querySelectorAll: () => [],
    body: el('body'),
    head: el('head'),
    documentElement: el('html'),
    title: '',
    addEventListener: noop
  };

  const win = {};
  globalThis.document = doc;
  globalThis.matchMedia = q => ({ matches: false, addEventListener: noop, addListener: noop });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = noop;
  globalThis.performance = { now: () => 0 };
  globalThis.innerWidth = 900; globalThis.innerHeight = 600;
  globalThis.devicePixelRatio = 1;
  globalThis.addEventListener = (t, f) => { (win[t] ||= []).push(f); };
  globalThis.removeEventListener = noop;
  globalThis.setTimeout = setTimeout; globalThis.clearTimeout = clearTimeout;
  Object.defineProperty(globalThis, 'location', {
    value: { search, protocol: 'https:', pathname: '/', href: 'https://x/', reload: noop },
    configurable: true
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'smoke', sendBeacon: () => true, clipboard: { writeText: async () => {} } },
    configurable: true
  });
  globalThis.window = globalThis;
  globalThis.AudioContext = undefined;   // no audio in node; setup must cope
  globalThis.localStorage = undefined;   // and must fall back to memory
  return { doc, win, made };
}

/* The bundle is one big IIFE in a <script>. Pull it out and run it the same
   way a browser would. */
function extractBundleScript(){
  const html = readFileSync(new URL('../standalone.html', import.meta.url), 'utf8');
  /* Only blocks a browser would execute as script. The page also carries a
     JSON-LD block for search engines, which is data wearing a <script> tag —
     running it would be a syntax error. */
  const blocks = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    const type = (m[1].match(/type\s*=\s*["']([^"']+)["']/) || [])[1];
    if (type && !/^(module|text\/javascript|application\/javascript)$/.test(type)) continue;
    blocks.push(m[2]);
  }
  return { html, blocks };
}

console.log('\nboot smoke test');
{
  const { html, blocks } = extractBundleScript();

  check('the bundle has no surviving module imports',
    !/^\s*import\s.*from\s*['"]/m.test(html));
  check('the bundle has no module script tags', !html.includes('type="module"'));
  check('every script block parses', blocks.length > 0);

  const { win, made } = installDom('');
  let booted = false, error = null;
  try {
    for (const src of blocks){
      // top-level await is legal in a module, so run each block as one
      const run = new Function('return (async () => {' + src + '\n})()');
      await run();
    }
    booted = true;
  } catch (err){
    error = err;
  }
  check('the page reaches the end of setup', booted,
    error ? '\n        ' + (error && error.message) : '');

  if (booted){
    await new Promise(r => setTimeout(r, 60));   // let the async boot settle
    check('it registered keyboard handling', Array.isArray(win.keydown) && win.keydown.length > 0);
    check('it wrote the day into the header',
      /Day \d+|Preview/.test(made.get('daynum')?.textContent || ''),
      '(' + (made.get('daynum')?.textContent || '') + ')');
    /* The sound control is an icon, so its state lives in aria-label rather
       than in text — which is also what a screen reader reads. */
    const soundLabel = made.get('btn-sound')?.attrs?.['aria-label'] || '';
    check('it survives without AudioContext', /Sound/i.test(soundLabel),
      '(' + soundLabel + ')');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
