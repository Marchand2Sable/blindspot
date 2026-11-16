import { GUARD_KINDS, TURN_TIME, type GuardKind } from '../core/constants';
import { wrapPi } from '../core/math';
import type { GuardDef, GuardState } from '../core/types';

/**
 * GuardAI — deterministic patrols.
 *
 * A guard's state is a pure function of time: guardAt(route, t). There is no
 * accumulated simulation state, so patrols are perfectly reproducible, the
 * LevelValidator can query any instant, and the player can learn a pattern.
 *
 * Timeline per waypoint i (cyclic):  [wait_i][walk i -> i+1]
 * During wait_i the guard turns from the previous heading to the next one over
 * TURN_TIME, then holds. Guards therefore never change direction without a visible turn.
 */
export interface GuardRoute {
  def: GuardDef;
  kind: GuardKind;
  range: number;
  fov: number; // radians
  period: number;
  offset: number;
  pts: { x: number; y: number }[];
  waits: number[];
  walkTimes: number[];
  headings: number[];
}

export function buildRoute(def: GuardDef): GuardRoute {
  if (def.path.length < 2) throw new Error('guard path needs at least 2 waypoints');
  let wps = def.path;
  if (!def.loop) {
    // ping-pong: A B C -> A B C B (cyclic back to A)
    wps = [...def.path, ...def.path.slice(1, -1).reverse()];
  }
  const n = wps.length;
  const pts = wps.map((w) => ({ x: w.x, y: w.y }));
  const waits = wps.map((w) => Math.max(w.wait ?? 0.8, TURN_TIME));
  const walkTimes: number[] = [];
  const headings: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) throw new Error('guard waypoints must be distinct');
    walkTimes.push(len / def.speed);
    headings.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  const period = waits.reduce((s, v) => s + v, 0) + walkTimes.reduce((s, v) => s + v, 0);
  const kind = def.kind ?? 'normal';
  const spec = GUARD_KINDS[kind];
  return {
    def,
    kind,
    range: def.range ?? spec.range,
    fov: ((def.fov ?? spec.fov) * Math.PI) / 180,
    period,
    offset: def.offset ?? 0,
    pts,
    waits,
    walkTimes,
    headings,
  };
}

export function guardAt(route: GuardRoute, t: number): GuardState {
  const n = route.pts.length;
  let u = (t + route.offset) % route.period;
  if (u < 0) u += route.period;
  for (let i = 0; i < n; i++) {
    const prevHeading = route.headings[(i + n - 1) % n];
    const heading = route.headings[i];
    const wait = route.waits[i];
    const p = route.pts[i];
    if (u < wait) {
      const k = Math.min(1, u / TURN_TIME);
      const angle = prevHeading + wrapPi(heading - prevHeading) * (k * k * (3 - 2 * k));
      return { x: p.x, y: p.y, angle, moving: false };
    }
    u -= wait;
    const walk = route.walkTimes[i];
    if (u < walk) {
      const q = route.pts[(i + 1) % n];
      const k = u / walk;
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, angle: heading, moving: true };
    }
    u -= walk;
  }
  const p = route.pts[0];
  return { x: p.x, y: p.y, angle: route.headings[0], moving: false };
}
