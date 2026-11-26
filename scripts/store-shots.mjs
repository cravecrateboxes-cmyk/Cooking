// Google Play phone screenshots (1080 x 1920, portrait) of the home-screen build, from seeded saves so each
// one shows a real moment of play: the title, a restaurant mid-build and finished, upgrades, the beach and
// the gem shop.
//
//   CHROME_PATH=/path/to/chromium [ONLY=6-gem-shop] node scripts/store-shots.mjs <webapp dir> <out dir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) throw new Error('usage: node scripts/store-shots.mjs <webapp dir> <out dir>');
const DIR = path.resolve(dirArg);
const OUT = path.resolve(outArg);
const ROOT = path.resolve(import.meta.dirname, '..');
const SETTLE_MS = 9000; // guests arrive, food cooks and the staff start moving
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = path.join(DIR, p === '/' ? 'index.html' : p);
  if (!file.startsWith(DIR) || !fs.existsSync(file) || p.endsWith('sw.js')) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const src = fs.readFileSync(path.join(ROOT, 'src/game/maps.ts'), 'utf8');
const pads = (from, to) => [...src.slice(src.indexOf(from), src.indexOf(to)).matchAll(/\{ id: '([a-z0-9_]+)', kind/g)].map((m) => m[1]);
const BARN = pads('export const BARN', 'export const TRUCK');
const TRUCK = pads('export const TRUCK', 'export const MAPS');
const map = (unlocked, lv, served) => ({ unlocked, upgrades: { speed: lv, capacity: lv, kitchen: lv, menu: lv }, served });
const save = (current, maps, coins, gems) => ({ v: 1, coins, gems, current, maps });

const SHOTS = [
  { name: '1-title', seed: save('barn', { barn: map(BARN.slice(0, 9), 1, 60) }, 420, 6), play: null },
  { name: '2-corner-grill', seed: save('barn', { barn: map(BARN.filter((id) => id !== 'next').slice(0, 11), 1, 90) }, 540, 6), play: 'barn' },
  { name: '3-corner-grill-busy', seed: save('barn', { barn: map(BARN, 3, 400) }, 2600, 14), play: 'barn' },
  { name: '4-upgrades', seed: save('barn', { barn: map(BARN, 2, 300) }, 1800, 9), play: 'barn', tap: '.round-btn.up' },
  { name: '5-beach-truck', seed: save('truck', { barn: map(BARN, 3, 400), truck: map(TRUCK.slice(0, 10), 1, 80) }, 900, 12), play: 'truck' },
  { name: '6-gem-shop', seed: save('truck', { barn: map(BARN, 3, 400), truck: map(TRUCK, 2, 300) }, 3100, 24), play: 'truck', tap: '.wallet.gem' },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--in-process-gpu'],
});
let failed = false;
for (const s of SHOTS.filter((x) => !process.env.ONLY || x.name === process.env.ONLY)) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((seed) => localStorage.setItem('order-up-save-v1', JSON.stringify(seed)), s.seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    failed = true;
    console.error(`${s.name}: page error: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      failed = true;
      console.error(`${s.name}: console error: ${m.text()}`);
    }
  });
  await page.goto(ORIGIN + '/');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120_000 });
  if (s.play) {
    await page.evaluate((m) => window.app.play(m), s.play);
    await page.waitForTimeout(SETTLE_MS);
  } else {
    await page.waitForTimeout(2500);
  }
  if (s.tap) {
    await page.tap(s.tap);
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`), timeout: 120_000 }); // software GL at 3x is slow
  console.warn(`shot ${s.name}`);
  await ctx.close();
}
await browser.close();
server.close();
if (failed) process.exit(1);
