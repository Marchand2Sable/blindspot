import { EXIT_RADIUS, HARDCORE_SWITCHES } from '../core/constants';
import type { GuardState, Level, LevelDef, Vec } from '../core/types';
import { DetectionSystem } from '../systems/detection';
import { buildRoute, guardAt, type GuardRoute } from '../systems/guard';
import { parseLevel } from '../systems/grid';
import { PlayerController, type PlayerBump } from '../systems/player';
import { VisionSystem } from '../systems/vision';

export type WorldStatus = 'playing' | 'won' | 'caught';

export interface WorldEvents {
  bump: PlayerBump | null;
  toggled: boolean;
  toggleDenied: boolean;
  seenNow: boolean;
}

/**
 * GameWorld — pure game state and rules. No DOM, no canvas, no audio:
 * this is what the unit tests and the validator-driven bot run against.
 */
export class GameWorld {
  level: Level;
  routes: GuardRoute[];
  guards: GuardState[];
  player = new PlayerController();
  vision: VisionSystem;
  detection: DetectionSystem;
  time = 0;
  status: WorldStatus = 'playing';
  /** Index of the guard that caught the player (-1 until caught). */
  caughtBy = -1;
  /** Tutorial only: while true the guards still move but cannot detect the player. */
  safe = false;

  /**
   * @param hardcore true: seen = instant loss, limited switches, no cooldown.
   */
  constructor(def: LevelDef, public readonly hardcore = false) {
    this.level = parseLevel(def);
    this.routes = def.guards.map((g) => buildRoute(g));
    this.guards = this.routes.map((r) => guardAt(r, 0));
    this.detection = new DetectionSystem(hardcore);
    this.vision = hardcore
      ? new VisionSystem(0, def.hardSwitches ?? HARDCORE_SWITCHES)
      : new VisionSystem(def.cooldown);
    this.player.reset(this.level);
  }

  /** Advance the world by dt seconds. `wantToggle` is an edge-triggered request. */
  step(dt: number, move: Vec, wantToggle: boolean): WorldEvents {
    const ev: WorldEvents = { bump: null, toggled: false, toggleDenied: false, seenNow: false };
    if (this.status !== 'playing') return ev;

    if (wantToggle) {
      if (this.vision.toggle()) ev.toggled = true;
      else ev.toggleDenied = true;
    }
    this.vision.update(dt);

    ev.bump = this.player.update(dt, move, this.level);

    this.time += dt;
    this.guards = this.routes.map((r) => guardAt(r, this.time));
    const det = this.safe
      ? { meter: 0, seen: false, caught: false, by: -1 }
      : this.detection.update(dt, this.level, this.routes, this.guards, this.player.pos);
    if (this.safe) this.detection.reset();
    ev.seenNow = det.seen;
    if (det.caught) {
      this.status = 'caught';
      this.caughtBy = det.by;
      return ev;
    }
    const ex = this.player.x - this.level.exit.x;
    const ey = this.player.y - this.level.exit.y;
    if (Math.hypot(ex, ey) <= EXIT_RADIUS) this.status = 'won';
    return ev;
  }
}
