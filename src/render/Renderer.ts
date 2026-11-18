import { GUARD_KINDS, GUARD_RANGE, PLAYER_RADIUS } from '../core/constants';
import { smoothstep, TAU } from '../core/math';
import type { GameWorld } from '../engine/GameWorld';
import { castRay, isWall } from '../systems/grid';

/** Palette (shared with MONOLITH / TWO TONE STUDIO). */
export const PAL = {
  ink: '#171717',
  anthracite: '#454545',
  mid: '#777777',
  light: '#AAAAAA',
  paper: '#F0EFEA',
  white: '#FFFFFF',
  /** DAY: dark world — secondary black backdrop, anthracite floor, black walls. */
  dayBg: '#252525',
  floorDay: '#454545',
  gridDay: 'rgba(240,239,234,0.07)',
  /** NIGHT: the void. */
  nightBg: '#171717',
} as const;

export interface Bump {
  cx: number;
  cy: number;
  age: number;
}

export interface FxState {
  /** Real time in seconds (animations). */
  now: number;
  bumps: Bump[];
  /** Pixel screen shake amplitude. */
  shake: number;
  reducedMotion: boolean;
}

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/**
 * Renderer — draws a GameWorld. It only reads state; it never changes the game.
 *
 * DAY  : paper floor, black walls/player, guards NOT drawn at all.
 * NIGHT: dark void, walls NOT drawn at all, guards + their cones in white, black player with a rim light.
 * The two layers are cross-faded with `world.vision.blend`, so there is never a moment when
 * both are fully visible.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private ts = 32;
  private ox = 0;
  private oy = 0;
  private wallCache: { key: string; canvas: HTMLCanvasElement } | null = null;
  /** Pixels reserved at top (HUD) and bottom (touch controls). */
  topInset = 64;
  bottomInset = 16;

  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D unavailable');
    this.ctx = c;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.wallCache = null;
  }

  /** Screen rectangle (CSS pixels) of a tile rectangle of the current level; used by the tutorial highlights. */
  tileRect(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number } {
    return { x: this.ox + x0 * this.ts, y: this.oy + y0 * this.ts, w: (x1 - x0) * this.ts, h: (y1 - y0) * this.ts };
  }

  /** Extra pixels kept free at the bottom (above the controls): the tutorial card docks there on small screens. */
  dockBottom = 0;
  /** Extra pixels kept free on the right: the tutorial card sits there when the screen is wide but short. */
  dockRight = 0;

  private computeLayout(world: GameWorld, dock: number, dockR: number) {
    const { width, height } = world.level;
    // Room reserved for the editorial HUD (top) and the key legend / touch controls (bottom).
    const narrow = this.w < 760;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    // the HUD (title, guard legend, switch card) can be taller than the base inset: keep the map clear of it
    const hud = document.body.classList.contains('hud-on') ? document.getElementById('hud') : null;
    const hudBottom = hud ? hud.getBoundingClientRect().bottom + 12 : 0;
    const topInset = Math.max(narrow ? 104 : 148, Math.ceil(hudBottom));
    const baseBottom = touch ? (narrow ? 150 : 130) : 152;
    const bottomInset = baseBottom + dock;
    const side = narrow ? 24 : 64;
    const availW = Math.max(40, this.w - side * 2 - dockR);
    const availH = Math.max(40, this.h - topInset - bottomInset);
    const ts = Math.max(12, Math.floor(Math.min(availW / width, availH / height)));
    const ox = Math.round(side + (availW - width * ts) / 2);
    const oy = Math.round(topInset + (availH - height * ts) / 2);
    return { topInset, bottomInset, baseBottom, ts, ox, oy };
  }

  private layout(world: GameWorld): void {
    const l = this.computeLayout(world, this.dockBottom, this.dockRight);
    this.topInset = l.topInset;
    this.bottomInset = l.bottomInset;
    this.ts = l.ts;
    this.ox = l.ox;
    this.oy = l.oy;
  }

  /**
   * Where the map would be with `dock` extra pixels reserved at the bottom (pure: nothing is changed).
   * `top` / `bottom` bound the band between the HUD and the controls, in CSS pixels.
   */
  mapBox(world: GameWorld, dock = 0, dockR = 0): { x: number; y: number; w: number; h: number; top: number; bottom: number } {
    const l = this.computeLayout(world, dock, dockR);
    return {
      x: l.ox,
      y: l.oy,
      w: world.level.width * l.ts,
      h: world.level.height * l.ts,
      top: l.topInset,
      bottom: this.h - l.baseBottom,
    };
  }

  private wallLayer(world: GameWorld): HTMLCanvasElement {
    const key = `${world.level.def.id}:${this.ts}:${this.dpr}:${this.w}x${this.h}:${this.ox},${this.oy}`;
    if (this.wallCache?.key === key) return this.wallCache.canvas;
    const cv = document.createElement('canvas');
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    const c = cv.getContext('2d');
    if (!c) throw new Error('Canvas 2D unavailable');
    c.scale(this.dpr, this.dpr);
    const { width, height } = world.level;
    const { ts, ox, oy } = this;
    // soft architectural shadow
    c.shadowColor = 'rgba(0,0,0,0.38)';
    c.shadowBlur = ts * 0.45;
    c.shadowOffsetX = ts * 0.1;
    c.shadowOffsetY = ts * 0.16;
    c.fillStyle = PAL.ink;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isWall(world.level, x, y)) c.fillRect(ox + x * ts - 0.5, oy + y * ts - 0.5, ts + 1, ts + 1);
      }
    }
    c.shadowColor = 'transparent';
    // thin highlight on wall edges that face open floor: reads as a lit top edge
    c.fillStyle = 'rgba(240,239,234,0.10)';
    const e = Math.max(1, Math.round(ts * 0.05));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isWall(world.level, x, y)) continue;
        if (!isWall(world.level, x, y + 1) && y + 1 < height) c.fillRect(ox + x * ts, oy + (y + 1) * ts - e, ts, e);
        if (!isWall(world.level, x + 1, y) && x + 1 < width) c.fillRect(ox + (x + 1) * ts - e, oy + y * ts, e, ts);
      }
    }
    this.wallCache = { key, canvas: cv };
    return cv;
  }

  draw(world: GameWorld, fx: FxState): void {
    // The window can be 0x0 at load (hidden pane) and some embeds never fire 'resize': self-heal.
    if (window.innerWidth !== this.w || window.innerHeight !== this.h) this.resize();
    if (this.w < 2 || this.h < 2) return;
    const { ctx, dpr } = this;
    this.layout(world);
    const { ts, ox, oy } = this;
    const b = smoothstep(world.vision.blend);
    const day = 1 - b;
    const px = ox + world.player.x * ts;
    const py = oy + world.player.y * ts;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Background: secondary black (day) -> void (night)
    ctx.fillStyle = mix(PAL.dayBg, PAL.nightBg, b);
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    if (fx.shake > 0 && !fx.reducedMotion) {
      ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    }

    // ---- DAY LAYER: floor + walls ----
    if (day > 0.01) {
      ctx.globalAlpha = day;
      const { width, height } = world.level;
      ctx.fillStyle = PAL.floorDay;
      ctx.fillRect(ox, oy, width * ts, height * ts);
      ctx.strokeStyle = PAL.gridDay;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        ctx.moveTo(ox + x * ts + 0.5, oy);
        ctx.lineTo(ox + x * ts + 0.5, oy + height * ts);
      }
      for (let y = 0; y <= height; y++) {
        ctx.moveTo(ox, oy + y * ts + 0.5);
        ctx.lineTo(ox + width * ts, oy + y * ts + 0.5);
      }
      ctx.stroke();
      ctx.drawImage(this.wallLayer(world), 0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }

    // ---- exit (readable in both modes: the goal is never hidden) ----
    this.drawExit(world, b, fx.now);

    // ---- NIGHT LAYER: wall-contact hints ----
    if (b > 0.01) {
      for (const bump of fx.bumps) {
        const a = Math.max(0, 1 - bump.age / 0.7) * b;
        ctx.strokeStyle = `rgba(240,239,234,${0.55 * a})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + bump.cx * ts + 1, oy + bump.cy * ts + 1, ts - 2, ts - 2);
      }
    } else if (fx.bumps.length) {
      // in day the walls are visible; show a soft pulse on the touched wall so refusals are explained too
      for (const bump of fx.bumps) {
        const a = Math.max(0, 1 - bump.age / 0.5);
        ctx.fillStyle = `rgba(240,239,234,${0.22 * a})`;
        ctx.fillRect(ox + bump.cx * ts, oy + bump.cy * ts, ts, ts);
      }
    }

    // ---- NIGHT LAYER: guards ----
    if (b > 0.01) {
      ctx.globalAlpha = b;
      world.guards.forEach((g, i) => this.drawGuard(world, i, g, fx.now));
      ctx.globalAlpha = 1;
    }

    // ---- player ----
    this.drawPlayer(world, px, py, b);

    // ---- vision switch ripple ----
    const sw = world.vision.sinceSwitch;
    if (sw < 0.6 && !fx.reducedMotion) {
      const k = sw / 0.6;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.strokeStyle = PAL.paper;
      ctx.globalAlpha = (1 - k) * 0.4;
      ctx.lineWidth = 2 + (1 - k) * 3;
      ctx.beginPath();
      ctx.arc(px, py, e * ts * 9, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawExit(world: GameWorld, b: number, now: number): void {
    const { ctx, ts, ox, oy } = this;
    const x = ox + world.level.exit.x * ts;
    const y = oy + world.level.exit.y * ts;
    const pulse = 0.5 + 0.5 * Math.sin(now * 2.4);
    void b;
    const col = PAL.paper;
    const s = ts * (0.62 + 0.04 * pulse);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, ts * 0.07);
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.18 + 0.1 * pulse;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
    // inner chevron
    ctx.beginPath();
    ctx.moveTo(x - s * 0.16, y - s * 0.12);
    ctx.lineTo(x + s * 0.06, y);
    ctx.lineTo(x - s * 0.16, y + s * 0.12);
    ctx.lineWidth = Math.max(2, ts * 0.06);
    ctx.stroke();
  }

  private drawGuard(world: GameWorld, i: number, g: { x: number; y: number; angle: number; moving: boolean }, now: number): void {
    const { ctx, ts, ox, oy } = this;
    const route = world.routes[i];
    const gx = ox + g.x * ts;
    const gy = oy + g.y * ts;
    const meter = world.detection.meter;

    // vision cone, clipped by walls with the same raycast the detection rules use
    const rays = 40;
    const range = route.range || GUARD_RANGE;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    for (let k = 0; k <= rays; k++) {
      const a = g.angle - route.fov / 2 + (route.fov * k) / rays;
      const d = castRay(world.level, g.x, g.y, a, range);
      ctx.lineTo(gx + Math.cos(a) * d * ts, gy + Math.sin(a) * d * ts);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, range * ts);
    const strength = 0.3 + 0.28 * meter;
    grad.addColorStop(0, `rgba(255,255,255,${strength})`);
    grad.addColorStop(1, `rgba(255,255,255,${0.03 + 0.05 * meter})`);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.3 * meter})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // silhouette
    const phase = g.moving ? now * 7 + i * 1.7 : 0;
    const sway = Math.sin(phase) * 0.1;
    const sz = GUARD_KINDS[route.kind].size;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(g.angle);
    ctx.scale(sz, sz);
    if (route.kind === 'heavy') {
      // heavy: an armour ring around the body
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1.5, ts * 0.06);
      ctx.beginPath();
      ctx.arc(0, 0, ts * 0.46, 0, TAU);
      ctx.stroke();
    }
    // feet
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const foot = Math.sin(phase) * ts * 0.14;
    ctx.beginPath();
    ctx.arc(foot, -ts * 0.13, ts * 0.07, 0, TAU);
    ctx.arc(-foot, ts * 0.13, ts * 0.07, 0, TAU);
    ctx.fill();
    // shoulders
    ctx.rotate(sway);
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 0.17, ts * 0.33, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(-sway);
    // head
    ctx.beginPath();
    ctx.arc(ts * 0.03, 0, ts * 0.17, 0, TAU);
    ctx.fill();
    // visor notch showing facing
    ctx.fillStyle = PAL.nightBg;
    ctx.beginPath();
    ctx.moveTo(ts * 0.2, 0);
    ctx.lineTo(ts * 0.1, -ts * 0.07);
    ctx.lineTo(ts * 0.1, ts * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  }

  private drawPlayer(world: GameWorld, px: number, py: number, b: number): void {
    const { ctx, ts } = this;
    const p = world.player;
    const caught = world.status === 'caught';
    ctx.save();
    ctx.translate(px, py);
    // soft shadow (day only)
    if (b < 0.99) {
      ctx.fillStyle = `rgba(0,0,0,${0.18 * (1 - b)})`;
      ctx.beginPath();
      ctx.ellipse(ts * 0.06, ts * 0.1, ts * 0.34, ts * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.rotate(p.angle);
    const phase = p.moving ? p.walkPhase : 0;
    const foot = Math.sin(phase) * ts * 0.15;
    const sway = Math.sin(phase) * 0.12;
    const body = '#0B0B0B';
    const rim = `rgba(240,239,234,${0.6 + 0.3 * b})`;
    ctx.fillStyle = body;
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1.5, ts * 0.05);
    // feet
    ctx.beginPath();
    ctx.arc(foot, -ts * 0.13, ts * 0.075, 0, TAU);
    ctx.arc(-foot, ts * 0.13, ts * 0.075, 0, TAU);
    ctx.fill();
    // shoulders
    ctx.rotate(sway);
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 0.17, ts * 0.33, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-sway);
    // head
    ctx.beginPath();
    ctx.arc(ts * 0.03, 0, ts * 0.17, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // cooldown arc (thin, grey)
    const v = world.vision;
    if (!v.ready) {
      ctx.strokeStyle = PAL.light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, ts * (PLAYER_RADIUS + 0.28), -Math.PI / 2, -Math.PI / 2 + TAU * v.cooldownRatio);
      ctx.stroke();
    }

    // detection ring
    const m = world.detection.meter;
    if (m > 0.01) {
      const col = PAL.white;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 + (caught ? 2 : 0);
      ctx.globalAlpha = 0.45 + 0.55 * m;
      ctx.beginPath();
      ctx.arc(px, py, ts * (PLAYER_RADIUS + 0.42), -Math.PI / 2, -Math.PI / 2 + TAU * m);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
