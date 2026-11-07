import { mkdir } from 'node:fs/promises';
import { Browser } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const out = '.taste-audit/drama-final'; await mkdir(out, { recursive: true });
const browser = await Browser.launch(), results = [];
try {
  for (const path of ['index.html', 'catalog.html', 'search.html?q=%EB%A7%89%EC%B0%A8', 'ranking.html', 'series.html?id=last-train', 'library.html']) for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ width, height: 900, mobile: width < 768, reducedMotion: true });
    try {
      await page.goto(`http://127.0.0.1:8766/docs/drama/templates/${path}`, { settleMs: 150 });
      await page.eval(async () => { await catui.drama.ready; await document.fonts.ready; await Promise.all([...document.images].map((im) => { im.loading = 'eager'; return im.decode().catch(() => {}); })); });
      for (const theme of ['light', 'dark']) {
        const data = await page.eval((theme) => {
          catui.drama.applyTheme(theme === 'dark');
          const ids = [...document.querySelectorAll('[id]')].map((e) => e.id), nav = document.querySelector('.Catui_dr-nav'), active = nav.querySelector('[aria-current="page"]');
          const a = nav.getBoundingClientRect(), b = active.getBoundingClientRect();
          const focus = document.querySelector('main button, main a, [data-catui-dr-theme]'); focus.focus({ preventScroll: true });
          const lum = (s) => { const values = s.match(/[\d.]+/g).slice(0, 3).map(Number).map((n) => s.startsWith('color(') ? n : n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
          const intro = document.querySelector('.Catui_dr-intro'), paragraph = intro?.querySelector('p');
          const contrast = paragraph ? (() => { const f = lum(getComputedStyle(paragraph).color), g = lum(getComputedStyle(intro).backgroundColor); return (Math.max(f, g) + .05) / (Math.min(f, g) + .05); })() : 99;
          return { width: innerWidth, theme, overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelectorAll('h1').length === 1, ids: new Set(ids).size === ids.length, labels: [...document.querySelectorAll('label[for]')].every((l) => document.getElementById(l.htmlFor)), images: [...document.images].every((im) => im.complete && im.naturalWidth > 0), current: b.left >= a.left - 1 && b.right <= a.right + 1, focus: document.activeElement === focus && getComputedStyle(focus).outlineStyle !== 'none', contrast };
        }, theme);
        data.path = path; data.errors = page.consoleErrors.slice(); results.push(data);
        if (width === 320 || width === 1440) await page.screenshot({ path: `${out}/${path.split('.')[0]}-${width}-${theme}.jpg`, quality: 84 });
      }
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
const failed = results.filter((r) => r.overflow || !r.title || !r.ids || !r.labels || !r.images || !r.current || !r.focus || r.contrast < 4.5 || r.errors.length);
console.log(JSON.stringify({ checked: results.length, failed: failed.length, details: failed }, null, 2));
if (failed.length) process.exitCode = 1;
