// Records a short phone-sized clip of the home-screen build. A software renderer is far too slow for real
// time, so the page's clocks (performance.now, animation frames, timers, CSS animations) run SLOW times
// slower than real, frames are captured as fast as the browser gives them, and each video frame takes the
// capture nearest its moment in game time. The result plays at true speed and smoothly at 24 fps.
//
//   CHROME_PATH=/path/to/chromium [CLIP_DPR=2] [SLOW=0.008] node scripts/clip.mjs <webapp dir> <out.mp4> [seconds]
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
const SLOW = +(process.env.SLOW || 0.008); // a software-rendered capture takes about 5 s
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
await ctx.addInitScript((slow) => {
  const pn = performance.now.bind(performance);
  const t0 = pn();
  const scale = (t) => t0 + (t - t0) * slow;
  performance.now = () => scale(pn());
  const d0 = Date.now();
  const realDate = Date.now;
  Date.now = () => d0 + (realDate() - d0) * slow;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => cb(scale(ts)));
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms = 0, ...rest) => st(fn, ms / slow, ...rest);
  const si = window.setInterval.bind(window);
  window.setInterval = (fn, ms = 0, ...rest) => si(fn, ms / slow, ...rest);
}, SLOW);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
await page.goto(ORIGIN + '/');
await page.waitForFunction(() => window.ready === true, null, { timeout: 300_000, polling: 500 });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
await page.evaluate(() => window.app.play('barn'));
const gameNow = () => page.evaluate(() => performance.now() / 1000);
const begin = (await gameNow()) + 2.5; // the map wipe and a few guests arriving

// capture as fast as the browser allows, noting each capture's moment in game time
const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
const caps = [];
let moved = false;
for (;;) {
  const t = (await gameNow()) - begin;
  if (t > SECONDS) break;
  if (!moved && t > SECONDS * 0.55) {
    moved = true;
    await page.evaluate(() => window.app.world.player.pos.set(4.9, 0, 5.4));
  }
  if (t < 0) continue;
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  const file = path.join(frames, `c${String(caps.length).padStart(5, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  caps.push({ t: (t + (await gameNow()) - begin) / 2, file });
  if (caps.length % 50 === 0) console.warn(`${caps.length} captures, ${t.toFixed(1)} of ${SECONDS} s`);
}
// one video frame every 1/FPS s of game time, each the nearest capture
const total = SECONDS * FPS;
let j = 0;
for (let f = 0; f < total; f++) {
  const want = f / FPS;
  while (j + 1 < caps.length && Math.abs(caps[j + 1].t - want) <= Math.abs(caps[j].t - want)) j++;
  fs.copyFileSync(caps[j].file, path.join(frames, `f${String(f).padStart(4, '0')}.jpg`));
}
await browser.close();
server.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.jpg'), '-vf', `scale=${Math.round(VIEW.width * 2)}:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT]);
fs.rmSync(frames, { recursive: true, force: true });
console.warn(`clip written: ${OUT} (${total} frames from ${caps.length} captures)`);
