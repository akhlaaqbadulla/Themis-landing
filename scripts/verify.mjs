/* Local verification harness — runs against a container on BASE_URL.
   Checks every page at multiple viewports for horizontal scroll, that
   the hamburger swaps in/out at the right breakpoint, that the canvas
   mounts, and takes a screenshot per (page, viewport) for spot review. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8766';
const OUT = resolve('scripts/screenshots');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-se',   w: 375,  h: 667  },
  { name: 'pixel-7',     w: 412,  h: 915  },
  { name: 'small-480',   w: 480,  h: 800  },
  { name: 'phablet-640', w: 640,  h: 900  },
  { name: 'tablet-768',  w: 768,  h: 1024 },
  { name: 'laptop-1024', w: 1024, h: 768  },
  { name: 'mbair-1710',  w: 1710, h: 1112 },
  { name: 'desktop-1920',w: 1920, h: 1080 },
];

const PAGES = ['/', '/about.html', '/contact.html', '/workflows.html', '/why-themis.html'];

const fail = [];
const pass = [];

const record = (tag, ok, note='') => {
  (ok ? pass : fail).push(`${ok ? '✓' : '✗'} ${tag}${note ? ' — ' + note : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.w >= 1024 ? 2 : 1, /* approximate Retina for desktop viewports */
    reducedMotion: 'reduce', /* keep the suite deterministic */
  });

  for (const path of PAGES) {
    const page = await ctx.newPage();
    const url = BASE + path;
    const tag = `${vp.name.padEnd(14)} ${path}`;

    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!res || res.status() !== 200) {
        record(tag, false, `status ${res ? res.status() : 'no-response'}`);
        await page.close();
        continue;
      }

      /* If the loading overlay exists, wait for it to hide before
         screenshotting — otherwise we capture the spinner page. */
      await page.waitForFunction(() => {
        const l = document.getElementById('loading');
        if (!l) return true;
        return l.classList.contains('fade-out') || getComputedStyle(l).display === 'none';
      }, { timeout: 20000 }).catch(() => {});

      /* Check 1: no horizontal scroll */
      const horiz = await page.evaluate(() => {
        const d = document.documentElement;
        return { scrollW: d.scrollWidth, clientW: d.clientWidth };
      });
      const hasHScroll = horiz.scrollW > horiz.clientW + 1; /* 1px slack for subpixel */
      record(tag + ' · no h-scroll', !hasHScroll,
        hasHScroll ? `scrollW=${horiz.scrollW} vs clientW=${horiz.clientW}` : '');

      /* Check 2: hamburger visibility matches breakpoint */
      const burgerVisible = await page.evaluate(() => {
        const b = document.querySelector('.nav-burger');
        if (!b) return null;
        const s = getComputedStyle(b);
        return s.display !== 'none' && s.visibility !== 'hidden';
      });
      const shouldBurger = vp.w < 768;
      if (burgerVisible === null) {
        record(tag + ' · nav-burger mounted', false, 'not found in DOM');
      } else {
        record(tag + ' · hamburger ' + (shouldBurger ? 'shown' : 'hidden'),
          burgerVisible === shouldBurger,
          burgerVisible !== shouldBurger ? `visible=${burgerVisible}` : '');
      }

      /* Check 3 (home only): canvas element exists */
      if (path === '/') {
        const canvasOK = await page.evaluate(() => {
          const c = document.getElementById('gates-canvas');
          if (!c) return false;
          return c.width > 0 && c.height > 0;
        });
        record(tag + ' · canvas mounted', canvasOK);
      }

      /* Check 4 (mobile only): hamburger opens the drawer */
      if (shouldBurger && path === '/') {
        await page.click('.nav-burger');
        await page.waitForTimeout(400);
        const open = await page.evaluate(() => {
          const menu = document.getElementById('nav-menu');
          if (!menu) return false;
          const s = getComputedStyle(menu);
          return parseFloat(s.opacity) > 0.5 && s.pointerEvents !== 'none';
        });
        record(tag + ' · hamburger opens drawer', open);
        /* close it for clean screenshot */
        await page.evaluate(() => { document.getElementById('nav-toggle').checked = false; });
        await page.waitForTimeout(200);
      }

      /* Screenshot */
      const shotName = `${vp.name}_${path.replace(/[\/.]/g, '_') || 'home'}.png`;
      await page.screenshot({ path: resolve(OUT, shotName), fullPage: false });
    } catch (e) {
      record(tag, false, String(e.message || e).slice(0, 80));
    }

    await page.close();
  }

  await ctx.close();
}

await browser.close();

/* ─── Report ─── */
console.log('\n──────── PASS (' + pass.length + ') ────────');
for (const p of pass) console.log(p);
console.log('\n──────── FAIL (' + fail.length + ') ────────');
for (const f of fail) console.log(f);
console.log('\nScreenshots: ' + OUT);

process.exit(fail.length === 0 ? 0 : 1);
