import {
  CATCH_DISTANCE,
  DETECT_DECAY_TIME,
  DETECT_CENTER_BOOST,
  DETECT_PROXIMITY_BOOST,
  DETECT_TIME,
} from '../core/constants';
import { clamp, wrapPi } from '../core/math';
import type { GuardState, Level, Vec } from '../core/types';
import { castRay } from './grid';
import type { GuardRoute } from './guard';

/**
 * DetectionSystem — the single set of rules used in every level.
 *
 * A guard SEES the player iff all hold:
 *   1. distance <= range (+ optional margin)
 *   2. the player is inside the guard's cone (|angle diff| <= fov / 2)
 *   3. no wall lies on the straight segment guard -> player (grid raycast)
 * Seen: the meter fills (faster when closer). Unseen: it drains.
 * Meter reaches 1 -> caught. Point-blank contact with line of sight -> caught at once.
 */

export interface SeeOptions {
  /** Extra range, tiles (used by the validator for safety margin). */
  rangeMargin?: number;
  /** Extra cone width, degrees (used by the validator). */
  fovMargin?: number;
}

/** How centred `p` is in the guard's cone: 0 on the edge, 1 dead ahead. */
export function sightCentrality(g: GuardState, route: GuardRoute, p: Vec): number {
  const off = Math.abs(wrapPi(Math.atan2(p.y - g.y, p.x - g.x) - g.angle));
  return clamp(1 - off / (route.fov / 2), 0, 1);
}

/** Returns proximity in (0,1] (1 = point-blank) if the guard sees `p`, else 0. */
export function sightProximity(
  level: Level,
  g: GuardState,
  route: GuardRoute,
  p: Vec,
  opts: SeeOptions = {},
): number {
  const range = route.range + (opts.rangeMargin ?? 0);
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const d = Math.hypot(dx, dy);
  if (d > range) return 0;
  const ang = Math.atan2(dy, dx);
  if (d > CATCH_DISTANCE) {
    const half = route.fov / 2 + ((opts.fovMargin ?? 0) * Math.PI) / 180;
    if (Math.abs(wrapPi(ang - g.angle)) > half) return 0;
  }
  if (d > 1e-6 && castRay(level, g.x, g.y, ang, d) < d - 1e-6) return 0;
  return clamp(1 - d / range, 0.001, 1);
}

export interface DetectionResult {
  meter: number;
  seen: boolean;
  caught: boolean;
  /** Index of the guard that sees the player best (-1 if none). */
  by: number;
}

export class DetectionSystem {
  meter = 0;

  /** Hardcore: being seen for a single frame is fatal (no meter to fill). */
  constructor(private instant = false) {}

  reset(): void {
    this.meter = 0;
  }

  update(
    dt: number,
    level: Level,
    routes: GuardRoute[],
    states: GuardState[],
    player: Vec,
  ): DetectionResult {
    let best = 0;
    let rate = 0;
    let by = -1;
    let contact = false;
    for (let i = 0; i < routes.length; i++) {
      const prox = sightProximity(level, states[i], routes[i], player);
      if (prox > 0) {
        // classic: the closer to the middle of the cone, the faster the meter fills
        const centre = this.instant ? 0 : sightCentrality(states[i], routes[i], player);
        rate = Math.max(rate, 1 + DETECT_PROXIMITY_BOOST * prox + DETECT_CENTER_BOOST * centre);
      }
      if (prox > best) {
        best = prox;
        by = i;
      }
      if (prox > 0 && Math.hypot(player.x - states[i].x, player.y - states[i].y) <= CATCH_DISTANCE) {
        contact = true;
      }
    }
    const seen = best > 0;
    if (seen) {
      this.meter += (dt / DETECT_TIME) * rate;
    } else {
      this.meter -= dt / DETECT_DECAY_TIME;
    }
    if (contact || (this.instant && seen)) this.meter = 1;
    this.meter = clamp(this.meter, 0, 1);
    return { meter: this.meter, seen, caught: this.meter >= 1, by };
  }
}
