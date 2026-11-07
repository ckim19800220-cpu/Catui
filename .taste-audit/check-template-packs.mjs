import { mkdir, writeFile } from 'node:fs/promises';
import { Browser } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const groups = {
  booking: ['packs', 'event', 'event-program', 'event-speakers', 'event-guide', 'restaurant', 'stay', 'classes', 'error-403', 'login'],
  shop: ['packs', 'food-store', 'living-store', 'error-403', 'login'],
  docskit: ['journal', 'notes'], community: ['error-403', 'login'], admin: ['login', 'error-403'],
};
const featured = ['booking/event', 'shop/food-store', 'shop/living-store', 'docskit/journal', 'docskit/notes', 'booking/login'];
const out = '.taste-audit/template-packs-final';
await mkdir(out, { recursive: true });
const browser = await Browser.launch(), results = [];
try {
  for (const [group, names] of Object.entries(groups)) for (const name of names) {
    const key = `${group}/${name}`, widths = featured.includes(key) ? [320, 390, 768, 1440] : [320, 1440];
    for (const width of widths) {
      const page = await browser.newPage({ width, height: width < 600 ? 844 : 900, mobile: width < 600, reducedMotion: true });
      try {
        await page.goto(`http://127.0.0.1:8766/docs/${group}/templates/${name}.html`, { settleMs: 200 });
        await page.eval(async () => {
          await Promise.all([document.fonts.ready, window.catui?.booking?.ready, window.catui?.docs?.ready, window.catui?.docs?.blogList?.ready, window.catui?.shop?.load(), window.catui?.shop?.cards?.ready]);
        });
        for (const theme of ['light', 'dark']) {
          const row = await page.eval((theme) => {
            document.documentElement.setAttribute('data-catui-theme', theme);
            const root = document.querySelector('main'), h1 = root.querySelector('h1'), ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
            const badLabels = [...document.querySelectorAll('label[for]')].filter((e) => !document.getElementById(e.htmlFor));
            const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
            const h = h1.getBoundingClientRect();
            const badHashes = [...root.querySelectorAll('a[href^="#"]')].filter((a) => a.hash.length > 1 && !document.getElementById(decodeURIComponent(a.hash.slice(1))));
            return { theme, width: innerWidth, h1: root.querySelectorAll('h1').length === 1, firstScreen: h.top >= 0 && h.bottom <= innerHeight, labels: badLabels.length === 0, unique: duplicates.length === 0, anchors: badHashes.length === 0, primary: root.querySelectorAll('.Catui_btn-primary').length <= 1, overflow: document.documentElement.scrollWidth > innerWidth, imageErrors: [...root.querySelectorAll('img')].filter((i) => i.complete && i.currentSrc && !i.naturalWidth && !i.hidden).length };
          }, theme);
          await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          row.keyboard = await page.eval(() => document.activeElement !== document.body && document.activeElement.matches(':focus-visible'));
          row.path = key; row.errors = page.consoleErrors.slice();
          results.push(row);
          if (featured.includes(key) && [320, 1440].includes(width)) await page.screenshot({ path: `${out}/${group}-${name}-${width}-${theme}.jpg`, quality: 82 });
        }
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.h1 || !r.firstScreen || !r.labels || !r.unique || !r.anchors || !r.primary || !r.keyboard || r.overflow || r.imageErrors || r.errors.length);
console.log(JSON.stringify({ checked: results.length, failed: failed.length, details: failed }, null, 2));
if (failed.length) process.exitCode = 1;
