import type { Vec } from '../core/types';

export interface InputHandlers {
  onToggle(): void;
  onPause(): void;
  onRestart(): void;
}

/**
 * InputController — keyboard (WASD / ZQSD / arrows) and touch (virtual joystick + vision button).
 * Movement is polled (getMove); discrete actions are edge-triggered callbacks.
 */
export class InputController {
  private keys = new Set<string>();
  private joy: Vec = { x: 0, y: 0 };
  private joyId: number | null = null;
  private joyOrigin: Vec = { x: 0, y: 0 };
  private readonly joyRadius = 56;

  constructor(
    private h: InputHandlers,
    private joyZone: HTMLElement,
    private joyBase: HTMLElement,
    private joyKnob: HTMLElement,
    visionBtn: HTMLElement,
  ) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.endJoy();
    });
    joyZone.addEventListener('pointerdown', (e) => this.joyStart(e));
    joyZone.addEventListener('pointermove', (e) => this.joyMove(e));
    joyZone.addEventListener('pointerup', (e) => this.joyEnd(e));
    joyZone.addEventListener('pointercancel', (e) => this.joyEnd(e));
    visionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.h.onToggle();
    });
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // never steal keys from a text field, nor from browser shortcuts (Ctrl+R reload, Cmd+R...)
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) {
      if (!(t instanceof HTMLInputElement && t.type === 'checkbox')) return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (down) {
      if (k === ' ' || k === 'spacebar' || k === 'e') {
        if (!e.repeat) this.h.onToggle();
        e.preventDefault();
        return;
      }
      if (k === 'escape' || k === 'p') {
        if (!e.repeat) this.h.onPause();
        return;
      }
      if (k === 'r') {
        if (!e.repeat) this.h.onRestart();
        return;
      }
    }
    if (['z', 'w', 'arrowup', 'q', 'a', 'arrowleft', 's', 'arrowdown', 'd', 'arrowright'].includes(k)) {
      if (down) this.keys.add(k);
      else this.keys.delete(k);
      e.preventDefault();
    }
  }

  getMove(): Vec {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('q') || k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('z') || k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (x !== 0 || y !== 0) {
      const m = Math.hypot(x, y);
      return { x: x / m, y: y / m };
    }
    return { x: this.joy.x, y: this.joy.y };
  }

  /** Release everything (used when a menu opens). */
  clear(): void {
    this.keys.clear();
    this.endJoy();
  }

  private joyStart(e: PointerEvent): void {
    if (this.joyId !== null) return;
    this.joyId = e.pointerId;
    this.joyZone.setPointerCapture(e.pointerId);
    this.joyOrigin = { x: e.clientX, y: e.clientY };
    this.joyBase.style.left = `${e.clientX}px`;
    this.joyBase.style.top = `${e.clientY}px`;
    this.joyBase.classList.add('active');
    this.joyKnob.style.transform = 'translate(0px, 0px)';
  }

  private joyMove(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    let dx = e.clientX - this.joyOrigin.x;
    let dy = e.clientY - this.joyOrigin.y;
    const m = Math.hypot(dx, dy);
    if (m > this.joyRadius) {
      dx = (dx / m) * this.joyRadius;
      dy = (dy / m) * this.joyRadius;
    }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = 0.18;
    const mag = Math.hypot(dx, dy) / this.joyRadius;
    if (mag < dead) this.joy = { x: 0, y: 0 };
    else {
      const s = (mag - dead) / (1 - dead);
      this.joy = { x: (dx / (mag * this.joyRadius)) * s, y: (dy / (mag * this.joyRadius)) * s };
    }
  }

  private joyEnd(e: PointerEvent): void {
    if (e.pointerId === this.joyId) this.endJoy();
  }

  private endJoy(): void {
    this.joyId = null;
    this.joy = { x: 0, y: 0 };
    this.joyBase.classList.remove('active');
  }
}
