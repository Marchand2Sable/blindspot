import type { Level, LevelDef } from '../core/types';
import { buildRoute, guardAt } from './guard';
import { isWall, parseLevel } from './grid';
import { sightProximity } from './detection';

/**
 * LevelValidator — proves a level is solvable and finds a reference solution.
 *
 * Search space: (cell, time-step). The player is modelled on cell centres moving
 * one cell (4-neighbourhood) or waiting per STEP seconds — slower than the real
 * player (4.2 tiles/s), so a validated level is feasible with slack.
 *
 * A validated route is NEVER seen, which is what hardcore mode (instant loss) needs:
 *  - guards are sampled 4 times per step (a turning guard sweeps its cone quickly);
 *  - during a step the player may be anywhere between two cell centres, so the start
 *    centre, the midpoint and the end centre must all be safe at every sub-instant;
 *  - detection uses inflated range and cone (SAFETY) and a minimum body distance.
 * Vision mode is irrelevant to feasibility (it only changes what is displayed).
 */

export const STEP = 0.25;
export const HORIZON_SECONDS = 150;
export const SAFETY = { rangeMargin: 0.4, fovMargin: 8 };
/** A validated route never passes closer than this to a guard (also covers contact-catch). */
export const BODY_CLEARANCE = 0.95;
const SUB = 4;

/** Safety margins used by the validator. Larger margins = the solution is more forgiving for a human. */
export interface Margins {
  rangeMargin: number;
  fovMargin: number;
  clearance: number;
}
export const BASE_MARGINS: Margins = { ...SAFETY, clearance: BODY_CLEARANCE };
/** Increasingly strict margins; the highest solvable index is the level's "slack" (see metrics.ts). */
export const MARGIN_LADDER: Margins[] = [
  BASE_MARGINS,
  { rangeMargin: 0.6, fovMargin: 12, clearance: 1.1 },
  { rangeMargin: 0.8, fovMargin: 16, clearance: 1.25 },
  { rangeMargin: 1.0, fovMargin: 20, clearance: 1.4 },
];

export interface ValidationResult {
  solvable: boolean;
  /** Cell centres (x, y) at each time step, from t = 0. */
  path: { x: number; y: number }[];
  /** Seconds of the reference solution. */
  time: number;
  /** Seconds of the shortest route if there were no guards. */
  directTime: number;
  /** time - directTime: how long the player must wait on the best route. */
  waitTime: number;
}

const NEIGHBOURS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function directSteps(level: Level): number {
  const { width, height } = level;
  const s = Math.floor(level.start.y) * width + Math.floor(level.start.x);
  const e = Math.floor(level.exit.y) * width + Math.floor(level.exit.x);
  const dist = new Int32Array(width * height).fill(-1);
  const q = [s];
  dist[s] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === e) return dist[c];
    const x = c % width;
    const y = (c / width) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      if ((dx === 0 && dy === 0) || isWall(level, x + dx, y + dy)) continue;
      const n = (y + dy) * width + (x + dx);
      if (dist[n] < 0) {
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
  }
  return Infinity;
}

/** @param blocked cells (index y*width+x) the player may not enter — used to look for alternative routes. */
export function validateLevel(def: LevelDef, margins: Margins = BASE_MARGINS, blocked?: ReadonlySet<number>): ValidationResult {
  const level = parseLevel(def);
  const routes = def.guards.map((g) => buildRoute(g));
  const { width, height } = level;
  const cells = width * height;
  const steps = Math.ceil(HORIZON_SECONDS / STEP);
  const start = Math.floor(level.start.y) * width + Math.floor(level.start.x);
  const exit = Math.floor(level.exit.y) * width + Math.floor(level.exit.x);

  const stateCache = new Map<number, ReturnType<typeof guardAt>[]>();
  const statesAt = (sub: number) => {
    let v = stateCache.get(sub);
    if (!v) {
      v = routes.map((r) => guardAt(r, (sub * STEP) / SUB));
      stateCache.set(sub, v);
    }
    return v;
  };
  // Unsafe = seen (with margins) or physically too close to a guard's body.
  const sight = { rangeMargin: margins.rangeMargin, fovMargin: margins.fovMargin };
  const unsafeMemo = new Map<number, boolean>();
  const unsafeAt = (sub: number, x: number, y: number): boolean => {
    const key = (sub * 128 + Math.round(x * 2)) * 128 + Math.round(y * 2);
    const hit = unsafeMemo.get(key);
    if (hit !== undefined) return hit;
    const gs = statesAt(sub);
    const bad = routes.some((r, i) => {
      const g = gs[i];
      return Math.hypot(g.x - x, g.y - y) < margins.clearance || sightProximity(level, g, r, { x, y }, sight) > 0;
    });
    unsafeMemo.set(key, bad);
    return bad;
  };
  const moveSafe = (k: number, x0: number, y0: number, x1: number, y1: number): boolean => {
    for (let j = 0; j <= SUB; j++) {
      const sub = k * SUB + j;
      if (unsafeAt(sub, x0, y0) || unsafeAt(sub, x1, y1) || unsafeAt(sub, (x0 + x1) / 2, (y0 + y1) / 2)) return false;
    }
    return true;
  };

  const cx = (c: number) => (c % width) + 0.5;
  const cy = (c: number) => Math.floor(c / width) + 0.5;

  const parents: Int32Array[] = [];
  let frontier = new Set<number>();
  if (!unsafeAt(0, cx(start), cy(start))) frontier.add(start);
  const directTime = directSteps(level) * STEP;
  const fail: ValidationResult = { solvable: false, path: [], time: Infinity, directTime, waitTime: Infinity };

  for (let k = 0; k < steps && frontier.size > 0; k++) {
    const par = new Int32Array(cells).fill(-1);
    parents.push(par);
    const next = new Set<number>();
    for (const c of frontier) {
      const x = c % width;
      const y = (c / width) | 0;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (isWall(level, nx, ny)) continue;
        const n = ny * width + nx;
        if (next.has(n) || (blocked && blocked.has(n) && n !== exit)) continue;
        if (!moveSafe(k, x + 0.5, y + 0.5, nx + 0.5, ny + 0.5)) continue;
        next.add(n);
        par[n] = c;
      }
    }
    frontier = next;
    if (frontier.has(exit)) {
      const rev: number[] = [exit];
      let cur = exit;
      for (let j = k; j >= 0; j--) {
        cur = parents[j][cur];
        rev.push(cur);
      }
      rev.reverse();
      const path = rev.map((c) => ({ x: cx(c), y: cy(c) }));
      const time = (rev.length - 1) * STEP;
      return { solvable: true, path, time, directTime, waitTime: time - directTime };
    }
  }
  return fail;
}
