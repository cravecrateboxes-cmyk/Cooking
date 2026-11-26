import * as THREE from 'three';
import { music } from './audio/music';
import { sfx } from './audio/sfx';
import { CameraRig } from './engine/cameraRig';
import { Input } from './engine/input';
import { GEM_ITEMS, UPGRADE_COSTS, type GemItem, type UpgradeId } from './game/config';
import { Guide } from './game/guide';
import { MAPS } from './game/maps';
import { loadSave, writeSave, type MapId, type SaveData } from './game/save';
import { World, type FloatKind, type Impact, type WorldUI } from './game/world';
import { Hud } from './ui/hud';
import { Labels } from './ui/labels';
import { MainMenu, SettingsPanel } from './ui/menu';
import { GemShop, UpgradePanel } from './ui/panels';
import { haptic } from './ui/haptics';
import { icon } from './ui/svg';
import { onTap } from './ui/tap';

const _v = new THREE.Vector3();
/** render resolution: up to the screen's own (phones are 3x), never under 2x on a phone screen */
const MAX_RATIO = 3;
const MIN_PHONE_RATIO = 2;
const RATIO_STEP = 0.25;
/** average frame times (ms) that lower or raise the resolution; 33 ms is a phone capped at 30 fps */
const SLOW_FRAME_MS = 38;
const FAST_FRAME_MS = 19;

/** Owns the renderer, the frame loop and the screens; builds a World for the current map. */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly rig: CameraRig;
  readonly save: SaveData;
  readonly labels: Labels;
  readonly hud: Hud;
  readonly ups: UpgradePanel;
  readonly shop: GemShop;
  readonly input: Input;
  world: World | null = null;
  private guide: Guide | null = null;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private last = performance.now();
  private slow = 0;
  private pixelRatio: number;
  /** never render below this: a phone screen at 1x looks blurry, which reads as a cheap game */
  private readonly minRatio: number;
  /** the highest ratio this device has held; a ratio it once dropped from is not tried again */
  private maxRatio: number;
  private fast = 0;
  paused = false;
  /** simulation steps per frame; only automated playtests change it */
  speed = 1;
  /** a little frame-time history so a struggling device drops resolution instead of stuttering */
  private frameAvg = 16;
  private traveling = false;
  /** title screen over the live scene, or playing */
  mode: 'menu' | 'play' = 'menu';
  private readonly menu: MainMenu;
  private readonly settings: SettingsPanel;
  private readonly wipe: HTMLDivElement;
  private readonly flash: HTMLDivElement;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly ui: HTMLElement,
    prepare: (r: THREE.WebGLRenderer) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const dpr = window.devicePixelRatio || 1;
    this.maxRatio = Math.min(dpr, MAX_RATIO);
    this.minRatio = Math.min(dpr, MIN_PHONE_RATIO);
    this.pixelRatio = this.maxRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    prepare(this.renderer);
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.save = loadSave();
    sfx.enabled = this.save.sound;
    const labelLayer = document.createElement('div');
    labelLayer.id = 'labels';
    labelLayer.className = 'layer';
    ui.appendChild(labelLayer);
    this.labels = new Labels(labelLayer);
    const stickLayer = document.createElement('div');
    stickLayer.className = 'layer stick-layer';
    ui.appendChild(stickLayer);
    this.input = new Input(canvas, stickLayer);
    this.hud = new Hud(ui);
    this.flash = document.createElement('div');
    this.flash.className = 'flash';
    ui.appendChild(this.flash);
    this.wipe = document.createElement('div');
    this.wipe.className = 'wipe';
    ui.appendChild(this.wipe);
    this.ups = new UpgradePanel(ui);
    this.shop = new GemShop(ui);
    this.menu = new MainMenu(ui);
    this.settings = new SettingsPanel(ui);
    this.hemi = new THREE.HemisphereLight('#d9f2ff', '#ffb98a', 1.55);
    this.sun = new THREE.DirectionalLight('#fff3dc', 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 13;
    sc.bottom = -13;
    sc.near = 1;
    sc.far = 40;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.wire();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  private wire(): void {
    onTap(this.hud.upgradeBtn, () => this.openUpgrades());
    onTap(this.hud.shopBtn, () => this.openShop());
    this.ups.onBuy = (id) => this.buyUpgrade(id);
    const back = () => (this.input.enabled = this.mode === 'play');
    this.ups.sheet.onClose = back;
    this.settings.sheet.onClose = back;
    onTap(this.hud.menuBtn, () => this.openSettings());
    onTap(this.menu.settingsBtn, () => this.openSettings());
    onTap(this.menu.chestBtn, () => this.openShop());
    this.menu.onPlay = (map) => this.play(map);
    this.menu.onSelect = (map) => this.travel(map, false);
    this.settings.onToggle = (what, on) => {
      if (what === 'sound') {
        this.save.sound = on;
        sfx.enabled = on;
        if (on) sfx.play('click');
      } else {
        this.save.music = on;
        if (on) music.start();
        else music.stop();
      }
      writeSave(this.save, true);
    };
    this.input.onFirstInput = () => {
      sfx.resume();
      if (this.save.music) music.start();
    };
    onTap(this.settings.homeBtn, () => {
      this.settings.sheet.hide();
      this.openMenu();
    });
    this.shop.onBuy = (it) => this.buyGemItem(it);
    this.shop.sheet.onClose = () => {
      back();
      if (this.mode === 'menu') this.menu.render(this.save, this.dailyReady());
    };
    onTap(this.shop.dailyBtn, () => this.claimDaily());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) writeSave(this.save, true);
    });
  }

  private makeUI(): WorldUI {
    return {
      money: (coins, gems, from, kind) => {
        if (from && kind) {
          _v.copy(from);
          _v.y += 1;
          _v.project(this.rig.camera);
          const x = (_v.x * 0.5 + 0.5) * innerWidth;
          const y = (-_v.y * 0.5 + 0.5) * innerHeight;
          const counter = kind === 'coin' ? this.hud.coins : this.hud.gems;
          const target = kind === 'coin' ? coins : gems;
          this.hud.flyTo(kind, x, y, () => {
            counter.set(Math.max(counter.target, target));
            counter.pop();
          });
          return;
        }
        this.hud.coins.set(coins);
        this.hud.gems.set(gems);
      },
      float: (at, text, kind) => this.floater(at, text, kind),
      impact: (kind) => this.impact(kind),
      progress: (done, total) => this.hud.progress(done, total),
      banner: (title, sub) => this.hud.banner(title, sub),
      openUpgrades: () => this.openUpgrades(),
      nextMap: (map) => this.travel(map),
    };
  }

  private floater(at: THREE.Vector3, text: string, kind: FloatKind): void {
    const e = document.createElement('div');
    e.className = `floater ${kind}`;
    if (kind === 'heart') e.appendChild(icon('heart'));
    else e.textContent = text;
    const l = this.labels.add(e, null, 0, at);
    setTimeout(() => this.labels.remove(l), 950);
  }

  /** What a moment feels like: a buzz where the phone can, a shake, and for unlocks a zoom punch and flash. */
  private impact(kind: Impact): void {
    haptic(kind);
    if (kind === 'light') return;
    if (kind === 'medium') {
      this.rig.addShake(0.12);
      return;
    }
    this.rig.addShake(0.3);
    this.rig.punch(1);
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
  }

  start(map: MapId): void {
    if (this.world) {
      this.world.scene.remove(this.sun, this.sun.target, this.hemi);
      this.world.dispose();
      this.labels.layer.innerHTML = '';
    }
    this.save.current = map;
    const w = new World(map, this.save, this.labels, this.makeUI());
    w.scene.background = new THREE.Color('#8fd8ff');
    w.scene.fog = new THREE.Fog('#8fd8ff', 34, 75);
    w.scene.add(this.hemi, this.sun, this.sun.target);
    this.world = w;
    this.guide = new Guide(w);
    if (this.mode === 'menu') this.guide.hide();
    this.hud.setMap(w.def.name);
    this.hud.coins.set(this.save.coins, true);
    this.hud.gems.set(this.save.gems, true);
    this.hud.progress(w.unlocks.done, w.unlocks.total);
    this.applyLook();
    const b = w.def.camBounds;
    this.rig.bounds = new THREE.Box2(new THREE.Vector2(b.minX, b.minZ), new THREE.Vector2(b.maxX, b.maxZ));
    this.rig.target.copy(w.player.pos);
    this.rig.snap(w.player.pos);
  }

  /** Put the chef's hat, clothes, shoes and colour on. */
  applyLook(): void {
    const w = this.world;
    if (!w) return;
    const eq = this.save.equipped;
    const model = (id: string | null) => GEM_ITEMS.find((g) => g.id === id)?.model ?? null;
    w.player.char.wear('hat', model(eq.hat) ?? 'cos_hat_toque');
    w.player.char.wear('outfit', model(eq.outfit) ?? 'cos_fit_apron');
    w.player.char.wear('shoes', model(eq.shoes));
    w.player.char.setColor(eq.colour ?? '#ff4b55');
  }

  /** Title screen: hide the game UI, let the camera drift around the live place. */
  openMenu(): void {
    this.mode = 'menu';
    this.input.release();
    this.input.enabled = false;
    this.hud.show(false);
    this.labels.layer.style.visibility = 'hidden';
    this.guide?.hide();
    this.rig.showcase = true;
    this.menu.render(this.save, this.dailyReady());
    this.menu.show(true);
    writeSave(this.save, true);
  }

  play(map: MapId): void {
    sfx.resume();
    if (this.save.music) music.start();
    if (this.world?.def.id !== map) this.start(map);
    this.mode = 'play';
    this.menu.show(false);
    this.hud.show(true);
    this.labels.layer.style.visibility = '';
    this.input.enabled = true;
    this.rig.showcase = false;
    this.rig.punch(1);
  }

  private openSettings(): void {
    this.ups.sheet.hide();
    this.shop.sheet.hide();
    this.settings.set('sound', this.save.sound);
    this.settings.set('music', this.save.music);
    this.settings.show(this.mode === 'play');
    this.input.release();
    this.input.enabled = false;
    sfx.play('whoosh');
  }

  private openUpgrades(): void {
    if (!this.world || this.ups.sheet.open) return;
    this.shop.sheet.hide();
    this.ups.render(this.world.progress, this.save.coins);
    this.ups.sheet.show();
    this.input.release();
    this.input.enabled = false;
    sfx.play('whoosh');
  }

  private openShop(): void {
    if (this.shop.sheet.open) return;
    this.ups.sheet.hide();
    this.renderShop();
    this.shop.sheet.show();
    this.input.release();
    this.input.enabled = false;
    sfx.play('whoosh');
  }

  private dailyReady(): boolean {
    return this.save.daily.last !== new Date().toDateString();
  }

  private dailyGems(): number {
    return 3 + Math.min(this.save.daily.streak, 4);
  }

  private renderShop(): void {
    this.shop.render(this.save, this.dailyReady(), this.dailyGems());
  }

  private claimDaily(): void {
    const w = this.world;
    if (!w || !this.dailyReady()) {
      sfx.play('deny');
      return;
    }
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    this.save.daily.streak = this.save.daily.last === yesterday ? this.save.daily.streak + 1 : 0;
    this.save.daily.last = new Date().toDateString();
    const n = this.dailyGems();
    w.earnGems(n, w.player.pos);
    w.fx.confettiBurst(_v.copy(w.player.pos).setY(1.2), 60, 6);
    writeSave(this.save, true);
    this.renderShop();
  }

  private buyUpgrade(id: UpgradeId): void {
    const w = this.world;
    if (!w) return;
    const lv = w.progress.upgrades[id];
    const cost = UPGRADE_COSTS[id][lv];
    if (cost === undefined || this.save.coins < cost) {
      sfx.play('deny');
      return;
    }
    this.save.coins -= cost;
    w.progress.upgrades[id] = lv + 1;
    w.applyUpgrades();
    writeSave(this.save, true);
    this.hud.coins.set(this.save.coins);
    this.ups.render(w.progress, this.save.coins);
    this.ups.flash(id);
    sfx.play('level');
    w.player.char.bump(-0.3);
    w.player.char.play('cheer', 0.1);
    w.fx.confettiBurst(_v.copy(w.player.pos).setY(1.4), 50, 5);
    w.fx.sparkle(_v, '#5ce27a', 14, 3);
  }

  private buyGemItem(it: GemItem): void {
    const w = this.world;
    if (!w) return;
    const s = this.save;
    const owned = s.owned.includes(it.id) || s.perks.includes(it.id);
    if (!owned) {
      if (s.gems < it.cost) {
        sfx.play('deny');
        return;
      }
      s.gems -= it.cost;
      if (it.kind === 'boost') s.rushUntil = Math.max(Date.now(), s.rushUntil) + 3 * 60_000;
      else if (it.kind === 'perk') s.perks.push(it.id);
      else s.owned.push(it.id);
      sfx.play('gem');
      w.fx.confettiBurst(_v.copy(w.player.pos).setY(1.4), 70, 6);
      w.player.char.play('cheer', 0.1);
    }
    // wearables toggle on and off once owned
    const eq = s.equipped;
    if (it.kind === 'hat') eq.hat = eq.hat === it.id && owned ? null : it.id;
    if (it.kind === 'outfit') eq.outfit = eq.outfit === it.id && owned ? null : it.id;
    if (it.kind === 'shoes') eq.shoes = eq.shoes === it.id && owned ? null : it.id;
    if (it.kind === 'colour') eq.colour = eq.colour === it.colour && owned ? null : (it.colour ?? null);
    this.applyLook();
    w.player.char.bump(-0.25);
    this.hud.gems.set(s.gems);
    writeSave(s, true);
    this.renderShop();
  }

  /** Iris wipe to another map: close on the chef, swap worlds, open on the new place. */
  travel(map: MapId, announce = true): void {
    if (this.traveling || this.world?.def.id === map) return;
    this.traveling = true;
    sfx.play('whoosh');
    const wipe = this.wipe;
    wipe.classList.remove('open');
    wipe.classList.add('on');
    setTimeout(() => {
      this.start(map);
      writeSave(this.save, true);
      wipe.classList.add('open');
      sfx.play('level');
      setTimeout(() => {
        wipe.classList.remove('on', 'open');
        this.traveling = false;
        if (announce) this.hud.banner(MAPS[map].name, 'New place unlocked');
        if (this.mode === 'menu') this.menu.render(this.save, this.dailyReady());
      }, 520);
    }, 560);
  }

  resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w / h, Math.min(w, h));
    this.labels.resize(w, h, this.hud.resize(w, h));
  }

  frame = (): void => {
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 1 / 20);
    this.adapt(raw * 1000);
    const w = this.world;
    if (!w) return;
    const playing = this.mode === 'play';
    if (!this.paused) {
      if (playing) this.input.update();
      else w.wish.set(0, 0, 0);
      this.rig.screenToWorld(this.input.dir.x, this.input.dir.y, w.wish);
      // testing hook: run the simulation faster in fixed slices without changing its behaviour
      const steps = Math.max(1, Math.round(this.speed));
      for (let i = 0; i < steps; i++) w.update(dt);
      if (playing) {
        this.guide?.update(dt);
        this.hud.setHint(this.guide?.hint ?? null);
      }
    }
    if (playing) {
      this.rig.target.copy(w.player.pos);
      this.rig.lookAhead.set(w.player.vel.x * 0.18, 0, w.player.vel.y * 0.18);
    } else {
      const b = w.def.camBounds;
      // halfway between the middle of the place and where the chef starts: the busiest part
      const s = w.def.start;
      this.rig.target.set(((b.minX + b.maxX) / 2 + s.x) / 2, 0, ((b.minZ + b.maxZ) / 2 + s.z) / 2);
      this.rig.lookAhead.set(0, 0, 0);
    }
    this.rig.update(dt);
    // shadows follow the camera focus so the play area always has crisp ones
    this.sun.target.position.copy(this.rig.target);
    this.sun.position.copy(this.rig.target).add(_v.set(-7, 16, 9));
    this.hud.update(dt);
    this.labels.update(this.rig.camera);
    this.renderer.render(w.scene, this.rig.camera);
  };

  private adapt(ms: number): void {
    if (ms > 200) return;
    this.frameAvg += (ms - this.frameAvg) * 0.05;
    // a phone held at 30 fps (low power mode, a busy viewer) is not struggling, so only clearly slower
    // frames lower the resolution, and steady fast frames raise it back
    if (this.frameAvg > SLOW_FRAME_MS && this.pixelRatio > this.minRatio) {
      this.fast = 0;
      if (++this.slow > 120) {
        this.slow = 0;
        this.maxRatio = this.pixelRatio - RATIO_STEP;
        this.setRatio(Math.max(this.minRatio, this.maxRatio));
      }
    } else if (this.frameAvg < FAST_FRAME_MS && this.pixelRatio < this.maxRatio) {
      this.slow = 0;
      if (++this.fast > 240) {
        this.fast = 0;
        this.setRatio(Math.min(this.maxRatio, this.pixelRatio + RATIO_STEP));
      }
    } else {
      this.slow = 0;
      this.fast = 0;
    }
  }

  private setRatio(r: number): void {
    this.pixelRatio = r;
    this.renderer.setPixelRatio(r);
    this.resize();
  }

}
