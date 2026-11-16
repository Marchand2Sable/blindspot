import type { LevelDef } from '../core/types';
import { buildRoute, guardAt } from './guard';
import { isWall, parseLevel } from './grid';
import { BASE_MARGINS, MARGIN_LADDER, STEP, validateLevel, type ValidationResult } from './validator';
import { sightProximity } from './detection';

/**
 * Level metrics — everything here is MEASURED from the level data or from the validator's
 * reference solution. Nothing is a guess. The final `score` combines them with provisional
 * weights (see WEIGHTS) that are meant to be tuned after playtests; it is a ranking aid,
 * not a verdict on fun.
 */
export interface LevelMetrics {
  id: string;
  size: string;
  /** Fraction of open cells whose 8 neighbours are all open (high = open room, low = corridors). */
  openness: number;
  /** Open cells with >= 3 open orthogonal neighbours that are not inside an open area. */
  junctions: number;
  /** Open cells with exactly one open neighbour (excluding start/exit). */
  deadEnds: number;
  guards: number;
  /** Number of distinct patrol periods (rounded to 0.1 s): how many cycles the player must learn. */
  distinctPeriods: number;
  solvable: boolean;
  /** Seconds of the shortest never-seen route. */
  solveTime: number;
  /** Seconds the reference route must spend waiting (beyond the guard-free shortest path). */
  waitTime: number;
  /** Number of separate waiting phases on the reference route. */
  waitPhases: number;
  /** Cells moved on the reference route. */
  moves: number;
  /** Highest margin-ladder rung (0-3) still solvable: higher = more forgiving. -1 if unsolvable. */
  slack: number;
  score: number;
}

export const WEIGHTS = {
  junctions: 0.2,
  deadEnds: 0.3,
  distinctPeriods: 0.7,
  guards: 0.2,
  waitTime: 0.25,
  waitPhases: 0.5,
  moves: 0.05,
  noSlack: 0.7, // per missing slack rung
  corridors: 1.5, // (1 - openness)
};

export function structure(def: LevelDef) {
  const level = parseLevel(def);
  let open = 0;
  let interior = 0;
  let junctions = 0;
  let deadEnds = 0;
  const sx = Math.floor(level.start.x);
  const sy = Math.floor(level.start.y);
  const ex = Math.floor(level.exit.x);
  const ey = Math.floor(level.exit.y);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (isWall(level, x, y)) continue;
      open++;
      let n4 = 0;
      let n8 = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (isWall(level, x + dx, y + dy)) continue;
          n8++;
          if (!dx || !dy) n4++;
        }
      }
      if (n8 === 8) interior++;
      // a real junction of corridors: >= 3 exits and walls on at least 3 of the 4 diagonals
      // (room edges have only 2 wall diagonals, so they are not counted)
      const diagWalls = 4 - (n8 - n4);
      if (n4 >= 3 && diagWalls >= 3) junctions++;
      if (n4 === 1 && !((x === sx && y === sy) || (x === ex && y === ey))) deadEnds++;
    }
  }
  return { open, openness: open ? interior / open : 0, junctions, deadEnds, width: level.width, height: level.height };
}

function waitPhases(path: ValidationResult['path']): number {
  let phases = 0;
  let waiting = false;
  for (let i = 1; i < path.length; i++) {
    const still = path[i].x === path[i - 1].x && path[i].y === path[i - 1].y;
    if (still && !waiting) phases++;
    waiting = still;
  }
  return phases;
}

export function measure(def: LevelDef, withSlack = true): LevelMetrics {
  const s = structure(def);
  const periods = new Set(def.guards.map((g) => buildRoute(g).period.toFixed(1)));
  const base = validateLevel(def, BASE_MARGINS);
  let slack = -1;
  if (base.solvable) {
    slack = 0;
    if (withSlack) {
      for (let i = 1; i < MARGIN_LADDER.length; i++) {
        if (validateLevel(def, MARGIN_LADDER[i]).solvable) slack = i;
        else break;
      }
    }
  }
  const moves = base.solvable
    ? base.path.reduce((n, p, i) => (i > 0 && (p.x !== base.path[i - 1].x || p.y !== base.path[i - 1].y) ? n + 1 : n), 0)
    : 0;
  const phases = base.solvable ? waitPhases(base.path) : 0;
  const w = WEIGHTS;
  const score = base.solvable
    ? w.junctions * s.junctions +
      w.deadEnds * s.deadEnds +
      w.distinctPeriods * periods.size +
      w.guards * def.guards.length +
      w.waitTime * Math.min(base.waitTime, 20) +
      w.waitPhases * phases +
      w.moves * moves +
      w.noSlack * (withSlack ? 3 - slack : 1.5) +
      w.corridors * (1 - s.openness)
    : 0;
  return {
    id: def.id,
    size: `${s.width}x${s.height}`,
    openness: Number(s.openness.toFixed(2)),
    junctions: s.junctions,
    deadEnds: s.deadEnds,
    guards: def.guards.length,
    distinctPeriods: periods.size,
    solvable: base.solvable,
    solveTime: base.time,
    waitTime: base.waitTime,
    waitPhases: phases,
    moves,
    slack,
    score: Number(score.toFixed(1)),
  };
}

/**
 * Similarity of two layouts in [0,1] (1 = identical): Jaccard index of INTERIOR wall cells
 * (the outer frame is ignored). Levels of different size are compared top-left aligned.
 * Used to detect a level that is just a slight variation of another one.
 */
export function layoutSimilarity(a: LevelDef, b: LevelDef): number {
  const la = parseLevel(a);
  const lb = parseLevel(b);
  const w = Math.max(la.width, lb.width);
  const h = Math.max(la.height, lb.height);
  let inter = 0;
  let union = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const wa = x < la.width - 1 && y < la.height - 1 && isWall(la, x, y);
      const wb = x < lb.width - 1 && y < lb.height - 1 && isWall(lb, x, y);
      if (wa && wb) inter++;
      if (wa || wb) union++;
    }
  }
  return union === 0 ? 1 : inter / union;
}

export { STEP };

/**
 * Cooldown pressure — a MEASURED proxy, not a proof.
 * The solver cannot model the cooldown (with perfect memory of the layout and patrols the
 * player would never need to switch). What the cooldown really constrains is *blindness*:
 * to read the guards you must be in NIGHT, to read the walls you must be in DAY, and after a
 * switch you are locked for `cooldown` seconds.
 * So the pressure is measured on the reference route: a "danger run" is a stretch of
 * consecutive cells that some guard can see at some moment of the patrol cycle. Inside it the
 * player ideally wants BOTH views (walls to steer, guards to time). We report:
 *  - dangerRun: longest danger run, in seconds;
 *  - turns: direction changes inside that run (more turns = more need to read walls);
 *  - ratio: dangerRun / cooldown. ratio >= 1 means you cannot re-look during the run.
 */
export interface CooldownPressure {
  dangerRun: number;
  turns: number;
  ratio: number;
}

export function cooldownPressure(def: LevelDef, path?: ValidationResult['path']): CooldownPressure {
  const level = parseLevel(def);
  const routes = def.guards.map(buildRoute);
  const sol = path ?? validateLevel(def).path;
  if (!sol.length) return { dangerRun: 0, turns: 0, ratio: 0 };
  const danger = new Set<number>();
  for (const r of routes) {
    const steps = Math.ceil(Math.min(r.period, 150) / 0.25);
    for (let k = 0; k < steps; k++) {
      const g = guardAt(r, k * 0.25);
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          if (isWall(level, x, y)) continue;
          if (sightProximity(level, g, r, { x: x + 0.5, y: y + 0.5 }) > 0) danger.add(y * level.width + x);
        }
      }
    }
  }
  const cellOf = (p: { x: number; y: number }) => Math.floor(p.y) * level.width + Math.floor(p.x);
  let best = 0;
  let bestTurns = 0;
  let run = 0;
  let turns = 0;
  let lastDir = '';
  for (let i = 1; i < sol.length; i++) {
    const moved = sol[i].x !== sol[i - 1].x || sol[i].y !== sol[i - 1].y;
    const inDanger = danger.has(cellOf(sol[i]));
    if (inDanger) {
      run++;
      if (moved) {
        const dir = `${sol[i].x - sol[i - 1].x},${sol[i].y - sol[i - 1].y}`;
        if (lastDir && dir !== lastDir) turns++;
        lastDir = dir;
      }
      if (run > best) { best = run; bestTurns = turns; }
    } else {
      run = 0;
      turns = 0;
      lastDir = '';
    }
  }
  const dangerRun = best * 0.25;
  return { dangerRun, turns: bestTurns, ratio: def.cooldown > 0 ? dangerRun / def.cooldown : 0 };
}
