import { describe, expect, it } from 'vitest';
import { TUTORIAL } from '../src/levels/tutorial';
import { GameWorld } from '../src/engine/GameWorld';
import { buildRoute } from '../src/systems/guard';
import { GUARD_KINDS } from '../src/core/constants';
import { freeRoute, startCheck, MIN_FIRST_SEEN } from '../src/systems/audit';
import { MARGIN_LADDER, validateLevel } from '../src/systems/validator';
import type { GuardDef } from '../src/core/types';

describe('level 0 (tutorial)', () => {
  it('is a real, solvable, fair level that needs the guard to be read', () => {
    const r = validateLevel(TUTORIAL);
    expect(r.solvable).toBe(true);
    expect(r.waitTime).toBeGreaterThanOrEqual(1.5);
    expect(validateLevel(TUTORIAL, MARGIN_LADDER[1]).solvable).toBe(true);
    expect(freeRoute(TUTORIAL)).toBe(0);
    const s = startCheck(TUTORIAL);
    expect(s.firstSeen).toBeGreaterThanOrEqual(MIN_FIRST_SEEN);
  });

  it('safe mode: a guard staring at the player cannot catch them; unsafe mode can, and names the guard', () => {
    const w = new GameWorld(TUTORIAL, false);
    const place = () => {
      const g = w.guards[0];
      w.player.x = g.x + Math.cos(g.angle) * 1.2;
      w.player.y = g.y + Math.sin(g.angle) * 1.2;
    };
    w.safe = true;
    for (let i = 0; i < 180; i++) {
      place();
      w.step(1 / 60, { x: 0, y: 0 }, false);
    }
    expect(w.status).toBe('playing');
    expect(w.detection.meter).toBe(0);
    w.safe = false;
    for (let i = 0; i < 180 && w.status === 'playing'; i++) {
      place();
      w.step(1 / 60, { x: 0, y: 0 }, false);
    }
    expect(w.status).toBe('caught');
    expect(w.caughtBy).toBe(0);
  });
});

describe('guard kinds', () => {
  const base: GuardDef = { speed: 2, path: [{ x: 1.5, y: 1.5 }, { x: 5.5, y: 1.5 }] };
  it('three kinds exactly, each with its own vision, and normal is the default', () => {
    expect(Object.keys(GUARD_KINDS).sort()).toEqual(['heavy', 'light', 'normal']);
    const n = buildRoute(base);
    const h = buildRoute({ ...base, kind: 'heavy' });
    const l = buildRoute({ ...base, kind: 'light' });
    expect(n.kind).toBe('normal');
    expect(h.range).toBeGreaterThan(n.range);
    expect(l.range).toBeLessThan(n.range);
    expect(h.fov).toBeLessThan(n.fov);
    expect(l.fov).toBeGreaterThan(n.fov);
  });
  it('speed bands are ordered: heavy slower than normal slower than light', () => {
    const k = GUARD_KINDS;
    expect(k.heavy.speedMax).toBeLessThan(k.normal.speedMin);
    expect(k.normal.speedMax).toBeLessThan(k.light.speedMin);
  });
});

describe('restart', () => {
  it('a fresh GameWorld restores everything a retry must reset', () => {
    const def = { ...TUTORIAL, hardSwitches: 3 };
    const w = new GameWorld(def, true);
    w.step(0.1, { x: 1, y: 0 }, true);
    expect(w.vision.switchesLeft).toBe(2);
    const again = new GameWorld(def, true);
    expect(again.vision.switchesLeft).toBe(3);
    expect(again.vision.mode).toBe('day');
    expect(again.time).toBe(0);
    expect(again.status).toBe('playing');
    expect(again.detection.meter).toBe(0);
    expect(again.caughtBy).toBe(-1);
    expect(again.player.x).toBe(again.level.start.x);
  });
});
