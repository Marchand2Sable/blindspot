import type { VisionMode } from '../core/types';

/**
 * AudioManager — all sounds are synthesised with WebAudio (no asset files).
 * The context is created lazily on the first user gesture (browser autoplay policy).
 * Everything is quiet by design: discreet ambience, short feedback cues.
 */
export class AudioManager {
  enabled = true;
  /** Master volume 0..1 (0.5 = the original loudness). */
  volume = 0.5;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private lastTick = 0;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  startAmbience(): void {
    if (!this.ctx || !this.master || this.drone) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 55;
    g.gain.value = 0.035;
    o.connect(g).connect(this.master);
    o.start();
    this.drone = o;
    this.droneGain = g;
  }

  setAmbienceMode(mode: VisionMode): void {
    if (!this.ctx || !this.drone) return;
    this.drone.frequency.setTargetAtTime(mode === 'night' ? 41 : 55, this.ctx.currentTime, 0.2);
    this.droneGain?.gain.setTargetAtTime(mode === 'night' ? 0.05 : 0.035, this.ctx.currentTime, 0.2);
  }

  click(): void {
    this.tone(520, 0.05, 'triangle', 0.08);
  }

  switchVision(to: VisionMode): void {
    if (to === 'night') this.tone(380, 0.28, 'sine', 0.14, 140);
    else this.tone(140, 0.28, 'sine', 0.14, 380);
  }

  denied(): void {
    this.tone(110, 0.09, 'square', 0.06);
    this.tone(95, 0.09, 'square', 0.06, undefined, 0.08);
  }

  bump(): void {
    this.tone(70, 0.07, 'sine', 0.08, 55);
  }

  /** Detection ticks that speed up and rise as the meter fills. */
  alert(meter: number, now: number): void {
    const interval = 0.38 - 0.3 * meter;
    if (now - this.lastTick < interval) return;
    this.lastTick = now;
    this.tone(420 + meter * 520, 0.06, 'square', 0.05 + meter * 0.04);
  }

  caught(): void {
    this.tone(220, 0.5, 'sawtooth', 0.14, 45);
    this.tone(110, 0.6, 'sine', 0.18, 30);
  }

  win(): void {
    this.tone(523, 0.22, 'sine', 0.12);
    this.tone(784, 0.4, 'sine', 0.12, undefined, 0.14);
    this.tone(1047, 0.6, 'sine', 0.09, undefined, 0.3);
  }
}
