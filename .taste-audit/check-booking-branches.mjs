import { mkdir } from 'node:fs/promises';
import { Browser } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const out = '.taste-audit/booking-branch-errors';
await mkdir(out, { recursive: true });
const browser = await Browser.launch(), results = [];
try {
  for (const [name, query] of [['date', '?svc=catui-day&branch=jeonju&date=2026-11-14'], ['rooms', '?svc=stay&branch=daehak&in=2026-11-14&out=2026-11-15']]) for (const width of [320, 1440]) {
    const page = await browser.newPage({ width, height: 900, mobile: width < 600, reducedMotion: true });
    try {
      await page.goto(`http://127.0.0.1:8766/docs/booking/templates/${name}.html${query}`, { settleMs: 300 });
      await page.eval(async () => { await Promise.all([catui.booking.datePage.ready, catui.booking.roomPage.ready, document.fonts.ready]); });
      for (const theme of ['light', 'dark']) {
        const r = await page.eval((theme) => {
          document.documentElement.setAttribute('data-catui-theme', theme);
          const notice = document.querySelector('[data-bk-empty]'), next = document.querySelector('[data-go]'), link = notice?.querySelector('a[href="index.html"]');
          link?.focus();
          return { theme, width: innerWidth, notice: !!link && notice.textContent.includes('지점'), blocked: !next || next.disabled || !!next.closest('[hidden]'), noPrice: !document.querySelector('[data-sum-total]'), overflow: document.documentElement.scrollWidth > innerWidth, focus: document.activeElement === link };
        }, theme);
        r.page = name; r.errors = page.consoleErrors.slice(); results.push(r);
        await page.screenshot({ path: `${out}/${name}-${width}-${theme}.jpg`, quality: 82 });
      }
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.notice || !r.blocked || !r.noPrice || r.overflow || !r.focus || r.errors.length);
console.log(JSON.stringify({ checked: results.length, failed: failed.length, details: failed }, null, 2));
if (failed.length) process.exitCode = 1;
