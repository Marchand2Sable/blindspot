import type { LevelDef } from '../core/types';
import { CATCH_DISTANCE } from '../core/constants';
import { buildRoute, guardAt } from './guard';
import { isWall, parseLevel } from './grid';
import { sightProximity } from './detection';
import { validateLevel, type ValidationResult } from './validator';

/**
 * Level audit — measured checks that the design really uses the vision switch and is fair.
 * Nothing here replaces a human playtest; these are guard-rails against known design failures.
 */

const OFFS: [number, number][] = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];

/** Cells (index y*width+x) that some guard can see, at some instant of the patrol cycle. */
export function dangerCells(def: LevelDef): Set<number> {
  const level = parseLevel(def);
  const routes = def.guards.map(buildRoute);
  const danger = new Set<number>();
  for (const r of routes) {
    const steps = Math.ceil(Math.min(r.period, 150) / 0.2);
    for (let k = 0; k < steps; k++) {
      const g = guardAt(r, k * 0.2);
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          const key = y * level.width + x;
          if (danger.has(key) || isWall(level, x, y)) continue;
          for (const [ox, oy] of OFFS) {
            if (sightProximity(level, g, r, { x: x + 0.5 + ox, y: y + 0.5 + oy }) > 0) {
              danger.add(key);
              break;
            }
          }
        }
      }
    }
  }
  return danger;
}

/**
 * Bypass check: is there a route from start to exit through cells that NO guard ever sees?
 * If so the level can be crossed without observing the guards at all (hugging walls, dead zones):
 * the NIGHT view is not needed. Returns the route length in cells, or 0 if there is no such route.
 */
export function freeRoute(def: LevelDef, danger: Set<number> = dangerCells(def)): number {
  const level = parseLevel(def);
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(level, nx, ny)) continue;
      const n = ny * width + nx;
      if (dist[n] >= 0 || (danger.has(n) && n !== e && n !== s)) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return 0;
}

export interface StartCheck {
  /** Seconds before a guard first sees a player standing still on the start cell (Infinity = never in 8 s). */
  firstSeen: number;
  /** Closest any guard comes to the start during the first 2.5 s. */
  minDist: number;
}

/** Fairness of the first seconds: the player must get time to read the scene and decide. */
export function startCheck(def: LevelDef): StartCheck {
  const level = parseLevel(def);
  const routes = def.guards.map(buildRoute);
  let firstSeen = Infinity;
  let minDist = Infinity;
  for (let t = 0; t <= 8; t += 0.05) {
    routes.forEach((r) => {
      const g = guardAt(r, t);
      if (t <= 2.5) minDist = Math.min(minDist, Math.hypot(g.x - level.start.x, g.y - level.start.y));
      if (firstSeen === Infinity && sightProximity(level, g, r, level.start) > 0) firstSeen = t;
    });
  }
  return { firstSeen, minDist };
}

export const MIN_FIRST_SEEN = 2.5;
export const MIN_START_DISTANCE = 2.5 + CATCH_DISTANCE;

/**
 * Alternative route: block the middle third of the reference route's cells and solve again.
 * True if the level can still be crossed, i.e. there is a genuinely different way (detour or other
 * corridor) and the level is not a single rigid sequence. Corridor mazes legitimately fail this.
 */
export function hasAlternativeRoute(def: LevelDef, ref: ValidationResult): boolean {
  if (!ref.solvable) return false;
  const level = parseLevel(def);
  const cells = ref.path.map((p) => Math.floor(p.y) * level.width + Math.floor(p.x));
  const distinct = [...new Set(cells)];
  if (distinct.length < 8) return false;
  const a = Math.floor(distinct.length / 3);
  const b = Math.ceil((2 * distinct.length) / 3);
  const blocked = new Set(distinct.slice(a, b));
  return validateLevel(def, undefined, blocked).solvable;
}

/** Number of separate stretches of the reference route that some guard can see at some time. */
export function dangerRuns(def: LevelDef, path: ValidationResult['path'], danger: Set<number> = dangerCells(def)): number {
  const level = parseLevel(def);
  let runs = 0;
  let inRun = false;
  for (const p of path) {
    const d = danger.has(Math.floor(p.y) * level.width + Math.floor(p.x));
    if (d && !inRun) runs++;
    inRun = d;
  }
  return runs;
}
