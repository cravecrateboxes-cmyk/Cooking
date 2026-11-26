// Touch playthrough: plays Order Up the way a phone does, inside a sandboxed iframe that matches the
// Claude artifact viewer (iPhone-sized, touch only, strict content security policy, no other hosts).
// Every tap and every step of the walk is a real touch event. The game's own state is only read, to
// check that each tap did what it should and to steer the chef. Fails on any console error, blocked
// request, unresponsive button or stall.
//
//   npm run artifact && npm run test:touch            full run: menu, both maps, every button
//   QUICK=1 npm run test:touch                        menu, buttons and a minute of play only
//   SPEED=3 OUT=test-results/touch CHROME_PATH=/path/to/chromium npm run test:touch
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const WEBAPP = !!process.env.WEBAPP; // test the home-screen build (webapp/) full screen instead of the viewer copy
const ART = path.join(ROOT, WEBAPP ? 'webapp' : 'artifact');
const OUT = path.resolve(ROOT, process.env.OUT || 'test-results/touch');
const SPEED = +(process.env.SPEED || 3);
const QUICK = !!process.env.QUICK;
const UNTIL = +(process.env.UNTIL || 0); // stop once this many pads were bought (the core loop: cook, serve, earn, buy)
const STALL = 300; // game seconds with no new unlock before the run counts as stuck
const VIEW = { width: 393, height: 852 }; // iPhone 15 screen
const FRAME = WEBAPP ? { top: 0, height: 852 } : { top: 60, height: 690 }; // the viewer's page area between its header and its prompt bar

fs.mkdirSync(OUT, { recursive: true });
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.error(`FAIL ${m}`);
};
const T0 = Date.now();
const step = (m) => console.warn(`.. ${((Date.now() - T0) / 1000).toFixed(0)}s ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- server: the artifact page in the viewer's skeleton, under a strict policy ----------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ');
const SKELETON = (inner) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${inner}</body></html>`;
const VIEWER = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;left:0;top:${FRAME.top}px;width:100%;height:${FRAME.height}px;border:0}</style></head><body><iframe id="art" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock" src="/page/"></iframe></body></html>`;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(VIEWER);
  if (url.pathname === '/page/') {
    if (WEBAPP) return res.writeHead(200, { 'content-type': 'text/html' }).end(fs.readFileSync(path.join(ART, 'index.html')));
    const page = fs.readFileSync(path.join(ART, 'order-up.html'), 'utf8');
    return res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP }).end(SKELETON(page));
  }
  const file = path.join(ART, url.pathname.replace(/^\/page\//, ''));
  if (!file.startsWith(ART) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-security-policy': CSP });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// ---------- browser: iPhone-sized, touch only ----------
// CHROME_PATH picks a Chromium build when Playwright's own browsers are not installed
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--in-process-gpu'],
});
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: +(process.env.DPR || 1), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    const t = m.text();
    if (/GPU stall|GL Driver Message|swiftshader/i.test(t)) return;
    if (m.type() === 'error') fail(`console error: ${t.slice(0, 300)}`);
  }
});
page.on('pageerror', (e) => fail(`page error: ${e.message}`));
page.on('request', (r) => {
  if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) fail(`request to another host: ${r.url()}`);
});
page.on('requestfailed', (r) => fail(`request failed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
// FROM=truck starts from a save with Corner Grill finished, so the Beach Truck can be played on its own
if (process.env.FROM === 'truck') {
  const src = fs.readFileSync(path.join(ROOT, 'src/game/maps.ts'), 'utf8');
  const barn = src.slice(src.indexOf('export const BARN'), src.indexOf('export const TRUCK'));
  const ids = [...barn.matchAll(/\{ id: '([a-z0-9_]+)', kind/g)].map((m) => m[1]);
  const seed = { v: 1, coins: 0, gems: 0, current: 'truck', maps: { barn: { unlocked: ids, upgrades: { speed: 0, capacity: 0, kitchen: 0, menu: 0 }, served: 0 } } };
  await ctx.addInitScript((seed) => {
    if (location.pathname.startsWith('/page/') && !sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('order-up-save-v1', JSON.stringify(seed));
    }
  }, seed);
}
await page.goto(ORIGIN + '/');
const frame = page.frames().find((f) => f.url().includes('/page/')) ?? (await (await page.$('#art')).contentFrame());
const cdp = await ctx.newCDPSession(page);
let shotN = 0;
const shot = async (name) => page.screenshot({ path: path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`) });

// ---------- touch helpers (outer page coordinates) ----------
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
/** Screen centre of an element named by a path from window, e.g. "app.hud.upgradeBtn". */
async function centre(ref) {
  const r = await frame.evaluate((ref) => {
    const e = typeof ref === 'string' && ref.startsWith('$') ? document.querySelector(ref.slice(1)) : ref.split('.').reduce((o, k) => o?.[k], window);
    if (!e || !e.getBoundingClientRect) return null;
    const b = e.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return null;
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    // a panel still sliding (any CSS transition running) is not ready for a finger yet
    if (document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === 'running')) return { x, y, covered: 'still sliding' };
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { x, y, covered: 'off screen' };
    return { x, y, covered: hit !== e && !e.contains(hit) ? `${hit.tagName}.${hit.className}` : '' };
  }, ref);
  if (!r) return null;
  return { x: r.x, y: r.y + FRAME.top, covered: r.covered };
}
const state = (fn, arg) => frame.evaluate(fn, arg);
/** Tap a button like a finger, then wait until `check` holds. */
async function tap(ref, label, check, arg) {
  // like a person, wait for a closing panel to finish sliding away before tapping
  // and for a panel sliding in to come to rest: the button must be uncovered and still for two looks
  let c = await centre(ref);
  for (let i = 0; i < 150; i++) {
    await sleep(60);
    const n = await centre(ref);
    const still = c && n && Math.abs(c.x - n.x) < 0.5 && Math.abs(c.y - n.y) < 0.5;
    c = n;
    if (still && !c.covered) break;
  }
  if (!c) return fail(`${label}: button not on screen`);
  if (c.covered) return fail(`${label}: something covers the button (${c.covered})`);
  await touch('touchStart', c.x, c.y);
  await sleep(60);
  await touch('touchEnd', c.x, c.y);
  for (let i = 0; i < 30; i++) {
    if (await state(check, arg)) return true;
    await sleep(50);
  }
  const seen = await frame.evaluate(([x, y]) => {
    const h = document.elementFromPoint(x, y);
    return { at: h ? `${h.tagName}.${h.className}` : 'nothing', open: [...document.querySelectorAll('.sheet.on')].map((e) => e.className) };
  }, [c.x, c.y - FRAME.top]);
  await shot(`fail-${label.replace(/\W+/g, '-')}`);
  fail(`${label}: the tap did nothing ${JSON.stringify(seen)}`);
  return false;
}
async function tapAt(x, y) {
  await touch('touchStart', x, y);
  await sleep(60);
  await touch('touchEnd', x, y);
}

// ---------- run ----------
try {
  await frame.waitForFunction(() => window.ready === true, null, { timeout: 60_000 });
  await sleep(1500);
  if (WEBAPP) {
    const sw = await state(() => navigator.serviceWorker.ready.then((r) => !!r.active));
    if (!sw) fail('the offline service worker did not start');
    const icons = await state(() => fetch('./manifest.webmanifest').then((r) => r.json()).then((m) => Promise.all(m.icons.map((i) => fetch(i.src).then((r) => r.ok)))));
    if (!icons.every(Boolean)) fail('an app icon is missing');
  }
  await shot('menu');
  step('menu buttons');
  await tap('app.menu.settingsBtn', 'menu settings', () => app.settings.sheet.open);
  await shot('menu-settings');
  await tap('$.sheet.on .sheet-x', 'settings close', () => !app.settings.sheet.open);
  await tap('app.menu.chestBtn', 'menu daily gift', () => app.shop.sheet.open);
  await shot('menu-shop');
  await tapAt(VIEW.width / 2, FRAME.top + 40); // the dim area above the sheet
  for (let i = 0; i < 20 && (await state(() => app.shop.sheet.open)); i++) await sleep(50);
  if (await state(() => app.shop.sheet.open)) fail('tapping outside the shop did not close it');
  await tap('$.play-btn', 'Play', () => app.mode === 'play');
  await sleep(1200);
  await shot('play-start');

  step('walk by dragging');
  const p0 = await state(() => [app.world.player.pos.x, app.world.player.pos.z]);
  const sx = VIEW.width / 2;
  const sy = FRAME.top + FRAME.height * 0.62;
  await touch('touchStart', sx, sy);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', sx + i * 5, sy - i * 2);
    await sleep(30);
  }
  await sleep(700);
  await shot('drag');
  await touch('touchEnd', sx, sy);
  const p1 = await state(() => [app.world.player.pos.x, app.world.player.pos.z]);
  if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.5) fail('dragging on the screen did not move the chef');

  step('game buttons');
  await tap('app.hud.upgradeBtn', 'Upgrades', () => app.ups.sheet.open);
  await shot('upgrades');
  await tap('$.sheet.on .sheet-x', 'Upgrades close', () => !app.ups.sheet.open);
  await tap('app.hud.menuBtn', 'settings', () => app.settings.sheet.open);
  const snd = await state(() => app.save.sound);
  await tap('$.sheet.on .toggle', 'sound toggle', (s) => app.save.sound !== s, snd);
  await tap('$.sheet.on .toggle', 'sound toggle back', () => app.save.sound === true);
  await tap('$.sheet.on .sheet-x', 'settings close', () => !app.settings.sheet.open);
  await tap('app.hud.shopBtn', 'gem shop', () => app.shop.sheet.open);
  await shot('gem-shop');
  await tap('$.sheet.on .sheet-x', 'gem shop close', () => !app.shop.sheet.open);

  // the chef must still walk after the sheets closed (once the last one has slid away)
  await sleep(900);
  const q0 = await state(() => [app.world.player.pos.x, app.world.player.pos.z]);
  await touch('touchStart', sx, sy);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', sx - i * 5, sy + i * 2);
    await sleep(30);
  }
  await sleep(600);
  await touch('touchEnd', sx, sy);
  const q1 = await state(() => [app.world.player.pos.x, app.world.player.pos.z]);
  if (Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) < 0.5) {
    const why = await state(() => ({ enabled: app.input.enabled, mode: app.mode, sheets: [...document.querySelectorAll('.sheet.on')].length }));
    fail(`after using the buttons, dragging no longer moves the chef ${JSON.stringify(why)}`);
  }

  await playMaps(QUICK && !UNTIL ? 60 : Infinity);

  if (!QUICK && !UNTIL) {
    step('title screen and map cards');
    await tap('app.hud.menuBtn', 'settings', () => app.settings.sheet.open);
    await tap('app.settings.homeBtn', 'Title screen', () => app.mode === 'menu');
    await sleep(900);
    await shot('menu-after');
    await tap('$.map-card:not(.picked)', 'other map card', () => document.querySelector('.map-card.picked') !== null);
    await tap('$.play-btn', 'Play again', () => app.mode === 'play');
    await sleep(1000);
    await shot('back-in-game');
  }
} catch (e) {
  fail(`run error: ${e.message}`);
} finally {
  await shot('end').catch(() => {});
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`\nTOUCH TEST FAILED (${failures.length})\n${failures.join('\n')}`);
  process.exit(1);
}
console.warn(`\nTOUCH TEST PASSED. Screenshots in ${path.relative(ROOT, OUT)}`);

// ---------- the playthrough: a steering brain in the page, the thumb from here ----------
async function playMaps(limitSec) {
  step(`play by touch at ${SPEED}x`);
  await state((speed) => {
    app.speed = speed;
    window.__speed = speed;
    window.__sim = 0;
    window.__budget = 0;
    window.__wrap = () => {
      const w = app.world;
      if (w.__timed) return;
      w.__timed = true;
      const u = w.update.bind(w);
      w.update = (dt) => {
        // lockstep: the game only advances by the time the test granted after its last touch, so slow
        // software rendering cannot make the chef overshoot between two looks
        if (window.__budget <= 0) return;
        window.__budget -= dt;
        window.__sim += dt;
        u(dt);
      };
    };
    window.__wrap();
  }, SPEED);
  installBrain();
  const t0 = Date.now();
  let held = false;
  let lastUnlock = { n: -1, map: '', at: 0 };
  let firstDone = 0;
  let boardOpens = 0;
  let dropped = 0; // thumb presses the joystick did not catch
  let nextTrace = 0;
  let nextUpgradeCheck = 0;
  let nextShot = 0;
  for (;;) {
    const s = await state(() => {
      window.__wrap();
      const w = app.world;
      return { sim: window.__sim, map: w.def.id, done: w.unlocks.done, total: w.unlocks.total, mode: app.mode, stick: window.__brain(), coins: app.save.coins, sheet: [app.ups, app.settings, app.shop].some((x) => x.sheet.open) };
    });
    if (s.mode !== 'play') {
      // a map change runs a short wipe; let it finish
      if (held) await touch('touchEnd', 0, 0);
      held = false;
      await state(() => (window.__budget = 1));
      await sleep(200);
      continue;
    }
    // walking over the upgrade board opens the Upgrades screen; close it like a player would
    if (s.sheet) {
      if (held) await touch('touchEnd', 0, 0);
      held = false;
      boardOpens++;
      await tap('$.sheet.on .sheet-x', 'Upgrades close (opened by the board)', () => ![app.ups, app.settings, app.shop].some((x) => x.sheet.open));
      continue;
    }
    if (s.done !== lastUnlock.n || s.map !== lastUnlock.map) {
      if (lastUnlock.n >= 0) step(`${s.map} ${s.done}/${s.total} at ${Math.round(s.sim)} s`);
      if (lastUnlock.n < 0) firstDone = s.done;
      lastUnlock = { n: s.done, map: s.map, at: s.sim };
    }
    if (s.sim - lastUnlock.at > STALL) {
      const why = await state(() => {
        const p = app.world.player;
        return { at: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], goal: window.__goal, carrying: p.stack.items.map((i) => i.kind), coins: app.save.coins, mode: app.mode, input: app.input.enabled, dir: [+app.input.dir.x.toFixed(2), +app.input.dir.y.toFixed(2)], vel: +p.vel.length().toFixed(2), route: window.__route };
      });
      fail(`stuck: no new unlock on ${s.map} for ${STALL} game seconds (${s.done}/${s.total}) ${JSON.stringify(why)}`);
      if (held) await touch('touchEnd', 0, 0);
      await shot('stuck');
      break;
    }
    if (s.map === 'truck' && s.done === s.total) {
      step(`both maps finished at ${Math.round(s.sim)} game seconds`);
      if (held) await touch('touchEnd', 0, 0);
      await sleep(800);
      await shot('truck-finished');
      break;
    }
    if (UNTIL && lastUnlock.n >= 0 && s.done >= firstDone + UNTIL) {
      step(`core loop done: ${s.done - firstDone} pads bought by touch at ${Math.round(s.sim)} game seconds, ${s.coins} coins, board opened Upgrades ${boardOpens} times, ${dropped} presses dropped`);
      if (held) await touch('touchEnd', 0, 0);
      await sleep(800);
      await shot('core-loop');
      break;
    }
    if ((Date.now() - t0) / 1000 > limitSec) {
      step(`stopped after ${limitSec} s: ${Math.round(s.sim)} game seconds, ${s.map} ${s.done}/${s.total}`);
      if (held) await touch('touchEnd', 0, 0);
      break;
    }
    if (process.env.TRACE && Date.now() > nextTrace) {
      nextTrace = Date.now() + 4000;
      const t = await state(() => ({ at: [+app.world.player.pos.x.toFixed(2), +app.world.player.pos.z.toFixed(2)], goal: window.__goal, coins: app.save.coins, carry: app.world.player.stack.items.length, input: app.input.enabled, dir: [+app.input.dir.x.toFixed(2), +app.input.dir.y.toFixed(2)] }));
      console.warn(`trace ${Math.round(s.sim)}s ${JSON.stringify(t)} stick ${JSON.stringify(s.stick?.map((v) => +v.toFixed(2)))}`);
    }
    if (Date.now() > nextShot) {
      nextShot = Date.now() + 60_000;
      await shot(`play-${s.map}-${s.done}`);
    }
    // buy an upgrade now and then, through the real Upgrades screen
    if (Date.now() > nextUpgradeCheck) {
      nextUpgradeCheck = Date.now() + 15_000;
      const id = await state(() => {
        const costs = { speed: [60, 180, 420, 900, 1800], capacity: [80, 220, 520, 1100, 2200], kitchen: [120, 300, 650, 1300, 2600], menu: [150, 400, 900, 1900, 3800] };
        for (const id of ['speed', 'capacity', 'kitchen', 'menu']) {
          const c = costs[id][app.world.progress.upgrades[id]];
          if (c !== undefined && app.save.coins > c * 2) return id;
        }
        return null;
      });
      if (id) {
        if (held) await touch('touchEnd', 0, 0);
        held = false;
        const lv = await state((id) => app.world.progress.upgrades[id], id);
        await tap('app.hud.upgradeBtn', 'Upgrades', () => app.ups.sheet.open);
        const ok = await tapUpgrade(id, lv);
        if (ok && shotN < 40 && lv === 0) await shot(`bought-${id}`);
        await tap('$.sheet.on .sheet-x', 'Upgrades close', () => !app.ups.sheet.open);
        continue;
      }
    }
    // steer with the thumb
    const ax = VIEW.width / 2;
    const ay = FRAME.top + FRAME.height * 0.6;
    if (!s.stick) {
      if (held) await touch('touchEnd', ax, ay);
      held = false;
    } else {
      const R = 46;
      const x = ax + s.stick[0] * R;
      const y = ay + s.stick[1] * R;
      if (!held) {
        await touch('touchStart', ax, ay);
        held = true;
      }
      await touch('touchMove', x, y);
      // a press the joystick did not catch is lifted and tried again, as a thumb would
      if (!(await state(() => app.input.touching))) {
        dropped += 1;
        await touch('touchEnd', ax, ay);
        held = false;
      }
    }
    // let the game run for the granted slice, then look again
    await state(() => {
      window.__budget = window.__step || 0.2;
      return new Promise((done) => {
        const wait = () => (window.__budget <= 0 || app.mode !== 'play' ? done() : requestAnimationFrame(wait));
        wait();
      });
    });
  }
  await state(() => (window.__budget = Infinity));
}

async function tapUpgrade(id, lv) {
  const ref = await state((id) => {
    const r = app.ups.rows.get(id);
    r.btn.dataset.touchTest = id;
    return `$[data-touch-test="${id}"]`;
  }, id);
  return tap(ref, `buy ${id} upgrade`, (a) => app.world.progress.upgrades[a.id] > a.lv, { id, lv });
}

function installBrain() {
  return state(() => {
    const V = (x, z) => ({ x, z });
    let goal = null;
    let route = [];
    let stayUntil = 0;
    let repathAt = 0;
    let blocked = 0;
    let sideUntil = 0;
    let sideSign = 1;
    let last = null;
    window.__brain = () => {
      const w = app.world;
      const p = w.player;
      const st = p.stack;
      const s = w.service;
      const now = window.__sim;
      const near = (x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r;
      const side = (tx, tz) => {
        const c = [[tx, tz + 1.25], [tx + 1.3, tz], [tx - 1.3, tz], [tx, tz - 1.25]];
        const free = c.filter(([x, z]) => !p.obstacles.some((o) => x > o.minX - 0.35 && x < o.maxX + 0.35 && z > o.minZ - 0.35 && z < o.maxZ + 0.35));
        free.sort((a, b) => Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z) - Math.hypot(b[0] - p.pos.x, b[1] - p.pos.z));
        return free[0] ?? c[0];
      };
      const pick = () => {
        if (w.cash.count > 0 && !st.holdsPlates) {
          const c = w.cash.root.position, sp = w.servePad.pos;
          const dx = sp.x - c.x, dz = sp.z - c.z, l = Math.hypot(dx, dz);
          return [c.x + dx / l, c.z + dz / l, 'cash'];
        }
        for (const t of w.tables) if (t.unlocked && t.cash.count > 0) return [...side(t.def.x, t.def.z), 'tcash'];
        for (const sp of w.unlocks.spots) {
          const price = sp.def.gems ? sp.def.gems : sp.def.cost;
          const have = sp.def.gems ? w.save.gems : w.save.coins;
          if (have + (w.progress.partial?.[sp.def.id] ?? 0) >= price) return [sp.def.x, sp.def.z, 'buy'];
        }
        if (st.holdsPlates && w.sinkOn) return [w.sinkPad.pos.x, w.sinkPad.pos.z, 'sink'];
        const fr = s.front();
        const fw = (d) => !!fr && fr.wants(d);
        const jam = !!fr && w.pass.full && !st.items.some((i) => fw(i.kind)) && !w.pass.has(fw);
        if (st.holdsFood && p.full && (jam || !st.items.some((i) => s.someoneWants(i.kind)))) return [w.binPad.pos.x, w.binPad.pos.z, 'bin'];
        const front = s.front();
        const seated = s.guests.filter((g) => g.state === 'seated');
        if (st.holdsFood) {
          if (front && front.state === 'ordering' && st.items.some((i) => front.wants(i.kind))) return [w.servePad.pos.x, w.servePad.pos.z, 'serve'];
          const sg = seated.find((g) => st.items.some((i) => g.wants(i.kind)));
          if (sg) {
            const tb = w.tables.find((t) => t.def.id === sg.tableId).def;
            return [...side(tb.x, tb.z), 'table'];
          }
          if (!w.pass.full && (p.full || !front)) return [w.servePad.pos.x, w.servePad.pos.z, 'stock'];
        }
        if (!st.holdsFood && w.sinkOn) {
          const d = w.tables.find((t) => t.unlocked && t.dirty && !t.busy);
          if (d) return [...side(d.def.x, d.def.z), 'plates'];
        }
        if (front && !p.full) {
          for (const l of front.order) {
            if (l.got >= l.want || st.items.some((i) => i.kind === l.dish) || w.pass.has((d) => d === l.dish)) continue;
            const stn = w.stations.find((x) => x.unlocked && x.dish === l.dish);
            if (stn) return [stn.pad.pos.x, stn.pad.pos.z, 'cook'];
          }
        }
        const need = new Map();
        const add = (g) => {
          for (const l of g.order) need.set(l.dish, (need.get(l.dish) ?? 0) + l.want - l.got);
        };
        if (front && front.state === 'ordering') add(front);
        seated.forEach(add);
        for (const g of s.guests) if (g.state === 'queue') add(g);
        for (const i of st.items) if (need.has(i.kind)) need.set(i.kind, need.get(i.kind) - 1);
        for (const pl of w.pass.piles) for (const i of pl.items) if (need.has(i.kind)) need.set(i.kind, need.get(i.kind) - 1);
        for (const [d, n] of need) {
          if (n <= 0 || p.full) continue;
          const stn = w.stations.find((x) => x.unlocked && x.dish === d);
          if (stn) return [stn.pad.pos.x, stn.pad.pos.z, 'cook'];
        }
        if (st.holdsFood && front) return [w.servePad.pos.x, w.servePad.pos.z, 'serve'];
        return [w.servePad.pos.x, w.servePad.pos.z, 'wait'];
      };
      if (w !== last) {
        last = w;
        route = [];
        stayUntil = 0;
      }
      if (now >= stayUntil) {
        goal = pick();
        window.__goal = goal;
        if (goal[2] === 'cook' && near(goal[0], goal[1], 0.35)) stayUntil = now + 0.6;
      }
      if (now >= repathAt || !route.length) {
        repathAt = now + 0.3;
        // the game's grid ignores chairs (guests sit in them), so the test plans on one that keeps the chef's body clear of everything it bumps into
        if (!w.__chefNav || w.__chefNavFor !== p.obstacles) {
          w.__chefNav = new w.nav.constructor(w.def.nav, p.obstacles, 0.34);
          w.__chefNavFor = p.obstacles;
        }
        route = w.__chefNav.path(p.pos.clone().setY(0), p.pos.clone().set(goal[0], 0, goal[1]));
      }
      while (route.length > 1 && Math.hypot(route[0].x - p.pos.x, route[0].z - p.pos.z) < 0.35) route.shift();
      window.__route = route.map((r) => [+r.x.toFixed(2), +r.z.toFixed(2)]);
      const wp = route.length ? route[0] : V(goal[0], goal[1]);
      const d = Math.hypot(wp.x - p.pos.x, wp.z - p.pos.z);
      // the test can only steer a few times a second; slow the game near the goal so the chef does not orbit it
      window.__step = d < 1.2 ? 0.05 : d < 3 ? 0.2 : 0.4; // game seconds to run before the next look
      if (d < (route.length > 1 ? 0.18 : 0.3)) {
        window.__step = 1; // standing still on a pad: let it work
        return null;
      }
      // invert the game's own stick mapping (cameraRig.screenToWorld): a thumb push of (x, y) walks along right*x - up*y
      const rig = app.rig;
      const wx = wp.x - p.pos.x;
      const wz = wp.z - p.pos.z;
      let dx = wx * Math.cos(rig.yaw) - wz * Math.sin(rig.yaw);
      let dy = wx * Math.sin(rig.yaw) + wz * Math.cos(rig.yaw);
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      if (p.vel.length() < 0.3 && d > 0.4) blocked += 1;
      else blocked = Math.max(0, blocked - 1);
      if (blocked > 8) {
        sideUntil = now + 0.45;
        blocked = 0;
        sideSign = -sideSign;
      }
      if (now < sideUntil) [dx, dy] = [-dy * sideSign, dx * sideSign];
      const m = Math.min(1, 0.3 + d / 1.2);
      return [dx * m, dy * m];
    };
  });
}
