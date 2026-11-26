// Records a short phone-sized clip of the home-screen build, frame by frame on a fake clock, so a slow
// software renderer still gives a smooth 24 fps video. Used for before-and-after comparisons.
//
//   CHROME_PATH=/path/to/chromium [CLIP_DPR=2] node scripts/clip.mjs <webapp dir> <out.mp4> [seconds]
//
// The restaurant runs itself (Corner Grill with its staff hired); halfway through, the chef steps onto
// the last table pad so the clip also shows an unlock.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const [dirArg, outArg, secArg] = process.argv.slice(2);
if (!dirArg || !outArg) throw new Error('usage: node scripts/clip.mjs <webapp dir> <out.mp4> [seconds]');
const DIR = path.resolve(dirArg);
const OUT = path.resolve(outArg);
const SECONDS = +(secArg || 9);
const FPS = 24;
const FRAME_MS = 1000 / FPS;
const VIEW = { width: 393, height: 852 };
const ROOT = path.resolve(import.meta.dirname, '..');

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

// Corner Grill with everything but the last table and the travel pad bought, and money to spend
const src = fs.readFileSync(path.join(ROOT, 'src/game/maps.ts'), 'utf8');
const barn = src.slice(src.indexOf('export const BARN'), src.indexOf('export const TRUCK'));
const ids = [...barn.matchAll(/\{ id: '([a-z0-9_]+)', kind/g)].map((m) => m[1]).filter((id) => id !== 't5' && id !== 'next');
const seed = { v: 1, coins: 900, gems: 3, current: 'barn', maps: { barn: { unlocked: ids, upgrades: { speed: 1, capacity: 1, kitchen: 1, menu: 1 }, served: 40 } } };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--in-process-gpu'],
});
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: +(process.env.CLIP_DPR || 2), isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.addInitScript((seed) => localStorage.setItem('order-up-save-v1', JSON.stringify(seed)), seed);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
await page.clock.install();
await page.goto(ORIGIN + '/', { waitUntil: 'commit' });
for (let i = 0; i < 600 && !(await page.evaluate(() => window.ready === true)); i++) await page.clock.runFor(100);
await page.evaluate(() => window.app.play('barn'));
await page.clock.runFor(2500); // the map wipe and a few guests arriving

// CSS animations run on real time, not the fake clock; slow them to the clip's pace
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');

const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
const total = SECONDS * FPS;
let t0 = Date.now();
for (let f = 0; f < total; f++) {
  if (f === Math.round(total * 0.55)) await page.evaluate(() => window.app.world.player.pos.set(4.9, 0, 5.4));
  await page.clock.runFor(FRAME_MS);
  // straight from the compositor: Playwright's own screenshot waits for a frame the fake clock never gives
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  fs.writeFileSync(path.join(frames, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
  if (f % 60 === 59) console.warn(`frame ${f + 1}/${total}`);
  if (f === 4) {
    const wall = (Date.now() - t0) / 5;
    await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, FRAME_MS / wall) });
  }
}
await browser.close();
server.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.jpg'), '-vf', `scale=${Math.round(VIEW.width * 2)}:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT]);
fs.rmSync(frames, { recursive: true, force: true });
console.warn(`clip written: ${OUT} (${total} frames)`);
