/* Targeted test: does the door animation actually advance on scroll
   across phone / tablet / desktop? Loads the page, scrolls to 25%,
   50%, 85% of the hero, screenshots each. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'https://the-company.ai';
const OUT = resolve('scripts/screenshots/door');
mkdirSync(OUT, { recursive: true });

const TIERS = [
  { name: 'phone-iphonese',  w: 375,  h: 667  },
  { name: 'phone-pixel',     w: 412,  h: 915  },
  { name: 'tablet-768',      w: 768,  h: 1024 },
  { name: 'desktop-mbair',   w: 1710, h: 1112 },
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });

for (const t of TIERS) {
  const ctx = await browser.newContext({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: t.w >= 1024 ? 2 : 1,
  });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  /* wait for loading overlay to clear */
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return !l || l.classList.contains('fade-out') || getComputedStyle(l).display === 'none';
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);

  /* Measure hero height + tier (capture what the JS decided at boot) */
  const info = await page.evaluate(() => {
    const hero = document.getElementById('gates-hero');
    return {
      heroPx: hero ? hero.offsetHeight : 0,
      vpW: window.innerWidth,
      vpH: window.innerHeight,
    };
  });
  const maxSc = info.heroPx - info.vpH;

  const positions = [
    { tag: '00-start',   y: 0 },
    { tag: '25-pct',     y: Math.round(maxSc * 0.25) },
    { tag: '50-pct',     y: Math.round(maxSc * 0.50) },
    { tag: '75-pct',     y: Math.round(maxSc * 0.75) },
    { tag: '90-pct',     y: Math.round(maxSc * 0.90) },
    { tag: '100-handoff', y: Math.round(maxSc * 1.00) },
    { tag: '110-after',  y: Math.round(maxSc * 1.00 + info.vpH * 0.4) },
  ];

  for (const p of positions) {
    await page.evaluate(y => window.scrollTo(0, y), p.y);
    await page.waitForTimeout(1800); /* rAF + draw + statue transition (1.4s) */
    const diag = await page.evaluate(() => {
      const s = document.querySelector('.themis');
      const canvas = document.getElementById('canvas-sticky');
      return {
        classes: document.body.className,
        statueOpacity: s ? getComputedStyle(s).opacity : 'n/a',
        canvasOpacity: canvas ? canvas.style.opacity || getComputedStyle(canvas).opacity : 'n/a',
      };
    });
    const name = `${t.name}_${p.tag}.png`;
    await page.screenshot({ path: resolve(OUT, name) });
    console.log(`${t.name.padEnd(20)} scrollY=${p.y.toString().padStart(5)}  canv=${String(diag.canvasOpacity).padStart(5)}  statue=${String(diag.statueOpacity).padStart(5)}  body="${diag.classes}"  ${name}`);
  }

  await page.close();
  await ctx.close();
}

await browser.close();
console.log('\nDoor-animation screenshots: ' + OUT);
