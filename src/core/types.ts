/** Shared data types. `core` depends on nothing; everything else may import from it. */

export interface Vec {
  x: number;
  y: number;
}

export type VisionMode = 'day' | 'night';

export interface Waypoint {
  x: number;
  y: number;
  /** Seconds spent at this waypoint (minimum is TURN_TIME, enforced by buildRoute). */
  wait?: number;
}

export type { GuardKind } from './constants';
import type { GuardKind } from './constants';

export interface GuardDef {
  /** Guard kind (default 'normal'): sets vision range / cone and the speed band, see GUARD_KINDS. */
  kind?: GuardKind;
  path: Waypoint[];
  /** true: path is a closed loop. false/undefined: ping-pong back and forth. */
  loop?: boolean;
  /** Tiles per second. */
  speed: number;
  /** Detection range override in tiles (defaults to the kind's range; avoid). */
  range?: number;
  /** Cone width override in degrees (defaults to the kind's cone; avoid). */
  fov?: number;
  /** Seconds to skip into the patrol cycle at t = 0, to desynchronise guards. */
  offset?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  /** Design intent: the one new thing this level makes the player think about (shown in docs/reports). */
  intent: string;
  /** Target difficulty, 1 (tutorial) to 10 (final trial). Compared with measured metrics in the report. */
  target: number;
  /** One short sentence shown at the start of the level. */
  hint: string;
  /** Vision switch cooldown, seconds (normal mode). */
  cooldown: number;
  /** Hardcore mode: how many vision switches are allowed (default HARDCORE_SWITCHES). */
  hardSwitches?: number;
  /** HARDCORE: the game-design reason for this switch budget (required, shown in docs). */
  switchWhy?: string;
  /** '#' wall, '.' floor, 'S' start, 'E' exit. All rows must have the same length. */
  map: string[];
  guards: GuardDef[];
}

export interface Level {
  def: LevelDef;
  width: number;
  height: number;
  /** Flat row-major wall grid. */
  walls: Uint8Array;
  start: Vec;
  exit: Vec;
}

export interface GuardState {
  x: number;
  y: number;
  /** Facing, radians. */
  angle: number;
  /** True while the guard is moving (drives the walk animation). */
  moving: boolean;
}
