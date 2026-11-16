import type { Level, LevelDef, Vec } from '../core/types';

/** Parse a LevelDef into a runtime Level. Throws on malformed maps. */
export function parseLevel(def: LevelDef): Level {
  const height = def.map.length;
  const width = def.map[0]?.length ?? 0;
  if (!height || !width) throw new Error(`${def.id}: empty map`);
  const walls = new Uint8Array(width * height);
  let start: Vec | null = null;
  let exit: Vec | null = null;
  def.map.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id}: row ${y} has width ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const c = row[x];
      if (c === '#') walls[y * width + x] = 1;
      else if (c === 'S') {
        if (start) throw new Error(`${def.id}: several starts`);
        start = { x: x + 0.5, y: y + 0.5 };
      } else if (c === 'E') {
        if (exit) throw new Error(`${def.id}: several exits`);
        exit = { x: x + 0.5, y: y + 0.5 };
      } else if (c !== '.') throw new Error(`${def.id}: unknown tile '${c}' at ${x},${y}`);
    }
  });
  if (!start) throw new Error(`${def.id}: no start`);
  if (!exit) throw new Error(`${def.id}: no exit`);
  return { def, width, height, walls, start, exit };
}

/** Out-of-bounds counts as wall, so levels are always closed. */
export function isWall(level: Level, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= level.width || cy >= level.height) return true;
  return level.walls[cy * level.width + cx] === 1;
}

/**
 * Distance from (ox, oy) along `angle` to the first wall, capped at maxDist (grid DDA).
 * Used both for guard line of sight and for drawing guard vision cones, so what the
 * player sees is exactly what the detection rules use.
 */
export function castRay(level: Level, ox: number, oy: number, angle: number, maxDist: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let cx = Math.floor(ox);
  let cy = Math.floor(oy);
  if (isWall(level, cx, cy)) return 0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = Math.abs(dx) < 1e-12 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = Math.abs(dy) < 1e-12 ? Infinity : Math.abs(1 / dy);
  let tMaxX = tDeltaX === Infinity ? Infinity : (dx > 0 ? cx + 1 - ox : ox - cx) * tDeltaX;
  let tMaxY = tDeltaY === Infinity ? Infinity : (dy > 0 ? cy + 1 - oy : oy - cy) * tDeltaY;
  for (;;) {
    let t: number;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      cy += stepY;
    }
    if (t >= maxDist) return maxDist;
    if (isWall(level, cx, cy)) return t;
  }
}

function circleHitsWall(level: Level, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!isWall(level, cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      const ddx = x - nx;
      const ddy = y - ny;
      if (ddx * ddx + ddy * ddy < r * r) return true;
    }
  }
  return false;
}

export interface MoveResult {
  x: number;
  y: number;
  blockedX: boolean;
  blockedY: boolean;
}

/**
 * Move a circle by (dx, dy), resolving each axis separately so it slides along walls.
 * Displacement is sub-stepped so fast movement can never tunnel through a wall.
 */
export function moveCircle(level: Level, x: number, y: number, dx: number, dy: number, r: number): MoveResult {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.1));
  const sx = dx / steps;
  const sy = dy / steps;
  let blockedX = false;
  let blockedY = false;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      if (circleHitsWall(level, x + sx, y, r)) blockedX = true;
      else x += sx;
    }
    if (sy !== 0) {
      if (circleHitsWall(level, x, y + sy, r)) blockedY = true;
      else y += sy;
    }
  }
  return { x, y, blockedX, blockedY };
}
