import { VISION_BLEND_TIME } from '../core/constants';
import type { VisionMode } from '../core/types';

/**
 * VisionSystem — DAY (see geometry) / NIGHT (see guards).
 * Switching is a tactical resource: after each switch the system is locked for
 * `cooldown` seconds. `blend` animates 0 (day) -> 1 (night) for rendering only;
 * it never influences gameplay.
 */
export class VisionSystem {
  mode: VisionMode = 'day';
  cooldownLeft = 0;
  blend = 0;
  /** Seconds since the last accepted switch (drives the transition ripple). */
  sinceSwitch = Infinity;

  /**
   * @param cooldown seconds locked after each switch (0 in hardcore).
   * @param switchesLeft maximum number of switches still allowed (Infinity = unlimited).
   */
  constructor(public cooldown: number, public switchesLeft: number = Infinity) {}

  get ready(): boolean {
    return this.cooldownLeft <= 0 && this.switchesLeft > 0;
  }

  /** 1 = just switched (fully locked), 0 = ready. */
  get cooldownRatio(): number {
    return this.cooldown > 0 ? Math.max(0, this.cooldownLeft / this.cooldown) : 0;
  }

  /** Returns true if the switch was accepted. */
  toggle(): boolean {
    if (!this.ready) return false;
    this.switchesLeft -= 1;
    this.mode = this.mode === 'day' ? 'night' : 'day';
    this.cooldownLeft = this.cooldown;
    this.sinceSwitch = 0;
    return true;
  }

  update(dt: number): void {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    this.sinceSwitch += dt;
    const target = this.mode === 'night' ? 1 : 0;
    const step = dt / VISION_BLEND_TIME;
    if (this.blend < target) this.blend = Math.min(target, this.blend + step);
    else if (this.blend > target) this.blend = Math.max(target, this.blend - step);
  }

  /** Gameplay-level truth: which information layer is visible right now. */
  get showsWalls(): boolean {
    return this.blend < 0.5;
  }
  get showsGuards(): boolean {
    return this.blend >= 0.5;
  }
}
