import { PLAYER_RADIUS, PLAYER_SPEED } from '../core/constants';
import { turnToward } from '../core/math';
import type { Level, Vec } from '../core/types';
import { moveCircle } from './grid';

export interface PlayerBump {
  /** Unit direction of the blocked axis motion, for feedback. */
  nx: number;
  ny: number;
}

/**
 * PlayerController — precise 8-way analog movement with wall sliding.
 * Input is a vector with magnitude <= 1 (keyboard is normalised, joystick is analog).
 */
export class PlayerController {
  x = 0;
  y = 0;
  angle = 0;
  /** Walk-cycle phase for animation. */
  walkPhase = 0;
  moving = false;

  reset(level: Level): void {
    this.x = level.start.x;
    this.y = level.start.y;
    this.angle = 0;
    this.walkPhase = 0;
    this.moving = false;
  }

  get pos(): Vec {
    return { x: this.x, y: this.y };
  }

  update(dt: number, input: Vec, level: Level): PlayerBump | null {
    let ix = input.x;
    let iy = input.y;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    this.moving = mag > 0.05;
    if (!this.moving) return null;
    const res = moveCircle(level, this.x, this.y, ix * PLAYER_SPEED * dt, iy * PLAYER_SPEED * dt, PLAYER_RADIUS);
    const travelled = Math.hypot(res.x - this.x, res.y - this.y);
    this.x = res.x;
    this.y = res.y;
    this.angle = turnToward(this.angle, Math.atan2(iy, ix), 14 * dt);
    this.walkPhase += travelled * 4.2;
    if (res.blockedX || res.blockedY) {
      return { nx: res.blockedX ? Math.sign(ix) : 0, ny: res.blockedY ? Math.sign(iy) : 0 };
    }
    return null;
  }
}
