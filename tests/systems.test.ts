import { describe, expect, it } from 'vitest';
import type { GuardDef, LevelDef } from '../src/core/types';
import { castRay, moveCircle, parseLevel } from '../src/systems/grid';
import { buildRoute, guardAt } from '../src/systems/guard';
import { DetectionSystem, sightProximity } from '../src/systems/detection';
import { VisionSystem } from '../src/systems/vision';
import { GameWorld } from '../src/engine/GameWorld';
import { PLAYER_RADIUS, DETECT_TIME } from '../src/core/constants';
import { SaveSystem } from '../src/engine/SaveSystem';

const room = (map: string[], guards: GuardDef[] = []): LevelDef => ({
  id: 't', name: 't', intent: 'test', target: 1, hint: '', cooldown: 2, map, guards,
});

const BOX = ['#######', '#S...E#', '#######'];

describe('grid / collisions', () => {
  it('rejects malformed maps', () => {
    expect(() => parseLevel(room(['###', '#S#']))).toThrow();
    expect(() => parseLevel(room(['####', '#..#', '####']))).toThrow(/no start/);
    expect(() => parseLevel(room(['#####', '#SSE#', '#####']))).toThrow(/several starts/);
  });

  it('blocks movement into walls and slides along them', () => {
    const lvl = parseLevel(room(['#####', '#S..#', '#...#', '#..E#', '#####']));
    // push hard into the left wall while moving down: x blocked, y free
    const r = moveCircle(lvl, 1.5, 1.5, -1, 0.5, PLAYER_RADIUS);
    expect(r.blockedX).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS - 1e-9);
    expect(r.y).toBeCloseTo(2, 5);
  });

  it('cannot tunnel through a wall at high speed', () => {
    const lvl = parseLevel(room(['#####', '#S#.#', '#.#E#', '#####']));
    const r = moveCircle(lvl, 1.5, 1.5, 3, 0, PLAYER_RADIUS);
    expect(r.x).toBeLessThan(2);
  });

  it('raycast stops at the first wall', () => {
    const lvl = parseLevel(room(['#######', '#S.#.E#', '#######']));
    expect(castRay(lvl, 1.5, 1.5, 0, 10)).toBeCloseTo(1.5, 5);
    expect(castRay(lvl, 4.5, 1.5, 0, 10)).toBeCloseTo(1.5, 5);
    expect(castRay(lvl, 1.5, 1.5, Math.PI, 10)).toBeCloseTo(0.5, 5);
  });
});

describe('guard patrols', () => {
  const def: GuardDef = {
    path: [{ x: 1.5, y: 1.5, wait: 1 }, { x: 5.5, y: 1.5, wait: 1 }],
    speed: 2,
  };
  const route = buildRoute(def);

  it('is deterministic and periodic', () => {
    for (const t of [0, 0.7, 3.3, 9.1]) {
      expect(guardAt(route, t)).toEqual(guardAt(route, t));
      const a = guardAt(route, t);
      const b = guardAt(route, t + route.period);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
      expect(b.angle).toBeCloseTo(a.angle, 6);
    }
  });

  it('period = waits + walking (ping-pong)', () => {
    expect(route.period).toBeCloseTo(1 + 2 + 1 + 2, 6); // wait, walk 4/2, wait, walk back
  });

  it('walks at the declared speed and faces its direction of travel', () => {
    const s = guardAt(route, 1 + 1); // 1 s wait + 1 s walking east
    expect(s.x).toBeCloseTo(3.5, 6);
    expect(s.angle).toBeCloseTo(0, 6);
    expect(s.moving).toBe(true);
    const back = guardAt(route, 1 + 2 + 1 + 1);
    expect(back.x).toBeCloseTo(3.5, 6);
    expect(Math.abs(back.angle)).toBeCloseTo(Math.PI, 6);
  });

  it('turns smoothly (never snaps) at the waypoints', () => {
    let prev = guardAt(route, 0).angle;
    for (let t = 0.01; t < route.period * 2; t += 0.01) {
      const a = guardAt(route, t).angle;
      let d = Math.abs(a - prev);
      if (d > Math.PI) d = 2 * Math.PI - d;
      expect(d).toBeLessThan(0.15);
      prev = a;
    }
  });

  it('applies the start offset', () => {
    const r2 = buildRoute({ ...def, offset: 2 });
    expect(guardAt(r2, 0).x).toBeCloseTo(guardAt(route, 2).x, 6);
  });
});

describe('detection', () => {
  const guardDef: GuardDef = { path: [{ x: 1.5, y: 1.5 }, { x: 1.5, y: 2.5 }], speed: 1 };
  const route = buildRoute(guardDef);
  const open = parseLevel(room(['#########', '#S......#', '#.......#', '#......E#', '#########']));
  const east = { x: 1.5, y: 1.5, angle: 0, moving: false };

  it('sees a player in range and in the cone', () => {
    expect(sightProximity(open, east, route, { x: 4.5, y: 1.5 })).toBeGreaterThan(0);
  });
  it('does not see beyond range', () => {
    expect(sightProximity(open, east, route, { x: 7.5, y: 1.5 })).toBe(0);
  });
  it('does not see outside the cone (behind or beside)', () => {
    expect(sightProximity(open, east, route, { x: 0.8, y: 1.5 })).toBe(0);
    expect(sightProximity(open, east, route, { x: 1.5, y: 3.5 })).toBe(0);
  });
  it('never sees through a wall', () => {
    const walled = parseLevel(room(['#########', '#S..#...#', '#...#...#', '#......E#', '#########']));
    expect(sightProximity(walled, east, route, { x: 6, y: 1.5 })).toBe(0);
    // same geometry without the wall sees the player
    expect(sightProximity(open, east, route, { x: 4, y: 1.5 })).toBeGreaterThan(0);
  });
  const timeToCatch = (p: { x: number; y: number }, instant = false) => {
    const det = new DetectionSystem(instant);
    let t = 0;
    let caught = false;
    while (!caught && t < 5) {
      caught = det.update(1 / 60, open, [route], [east], p).caught;
      t += 1 / 60;
    }
    return caught ? t : Infinity;
  };
  // far end of the range, on the edge of the cone (≈ 33° off the axis, half-fov is 35°)
  const edge = { x: 1.5 + 4.2 * Math.cos(0.58), y: 1.5 + 4.2 * Math.sin(0.58) };
  it('fills the meter over about DETECT_TIME on the edge of the cone and catches', () => {
    const t = timeToCatch(edge);
    expect(t).toBeGreaterThan(DETECT_TIME * 0.5);
    expect(t).toBeLessThan(DETECT_TIME * 1.6);
  });
  it('classic: the nearer the middle of the cone, the faster the detection', () => {
    const centre = timeToCatch({ x: 5.2, y: 1.5 });
    const mid = timeToCatch({ x: 1.5 + 3.7 * Math.cos(0.3), y: 1.5 + 3.7 * Math.sin(0.3) });
    const rim = timeToCatch({ x: 1.5 + 3.7 * Math.cos(0.58), y: 1.5 + 3.7 * Math.sin(0.58) });
    expect(centre).toBeLessThan(mid);
    expect(mid).toBeLessThan(rim);
    expect(centre).toBeLessThan(rim * 0.6);
  });
  it('drains when unseen', () => {
    const det = new DetectionSystem();
    for (let i = 0; i < 20; i++) det.update(1 / 60, open, [route], [east], { x: 5, y: 1.5 });
    const high = det.meter;
    expect(high).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) det.update(1 / 60, open, [route], [east], { x: 1.5, y: 3.5 });
    expect(det.meter).toBeLessThan(high);
  });
  it('point-blank contact catches instantly', () => {
    const det = new DetectionSystem();
    const r = det.update(1 / 60, open, [route], [east], { x: 1.9, y: 1.5 });
    expect(r.caught).toBe(true);
  });
});

describe('vision system', () => {
  it('toggles and applies the cooldown', () => {
    const v = new VisionSystem(2);
    expect(v.mode).toBe('day');
    expect(v.toggle()).toBe(true);
    expect(v.mode).toBe('night');
    expect(v.toggle()).toBe(false); // locked
    expect(v.mode).toBe('night');
    v.update(1);
    expect(v.toggle()).toBe(false);
    v.update(1.01);
    expect(v.ready).toBe(true);
    expect(v.toggle()).toBe(true);
    expect(v.mode).toBe('day');
  });
  it('reports the cooldown ratio', () => {
    const v = new VisionSystem(4);
    v.toggle();
    expect(v.cooldownRatio).toBeCloseTo(1, 5);
    v.update(1);
    expect(v.cooldownRatio).toBeCloseTo(0.75, 5);
  });
  it('information layers are mutually exclusive', () => {
    const v = new VisionSystem(0.1);
    for (let i = 0; i < 100; i++) {
      v.update(0.01);
      expect(v.showsWalls && v.showsGuards).toBe(false);
      if (i === 20) v.toggle();
    }
    expect(v.showsGuards).toBe(true);
    expect(v.showsWalls).toBe(false);
  });
});

describe('GameWorld rules', () => {
  it('wins when reaching the exit', () => {
    const w = new GameWorld(room(BOX));
    // no guards: walk right
    for (let i = 0; i < 200 && w.status === 'playing'; i++) w.step(1 / 60, { x: 1, y: 0 }, false);
    expect(w.status).toBe('won');
  });
  it('is lost when caught', () => {
    const def = room(
      ['#########', '#S.....E#', '#########'],
      [{ path: [{ x: 6.5, y: 1.5 }, { x: 5.5, y: 1.5 }], speed: 0.3 }],
    );
    // guard sits to the east facing the player: standing still is fatal
    const w = new GameWorld(def);
    for (let i = 0; i < 600 && w.status === 'playing'; i++) w.step(1 / 60, { x: 0, y: 0 }, false);
    expect(w.status).toBe('caught');
  });
  it('ignores input after the end', () => {
    const w = new GameWorld(room(BOX));
    w.status = 'won';
    const x = w.player.x;
    w.step(1, { x: 1, y: 0 }, true);
    expect(w.player.x).toBe(x);
  });
});

describe('SaveSystem', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('persists progress and best times', () => {
    const store = memory();
    const a = new SaveSystem(store);
    expect(a.data.unlocked).toBe(1);
    a.completeLevel(0, 12.3, 6);
    a.completeLevel(0, 20, 6); // worse time ignored
    const b = new SaveSystem(store);
    expect(b.data.unlocked).toBe(2);
    expect(b.data.best['0']).toBeCloseTo(12.3, 5);
  });
  it('survives corrupted storage', () => {
    const store = memory();
    store.setItem('blindspot.save.v1', '{not json');
    expect(new SaveSystem(store).data.unlocked).toBe(1);
  });
  it('never unlocks beyond the campaign', () => {
    const s = new SaveSystem(memory());
    s.completeLevel(5, 10, 6);
    expect(s.data.unlocked).toBe(6);
  });
});

describe('hardcore mode', () => {
  const corridor = (hard: boolean) =>
    new GameWorld(
      room(
        ['#########', '#S.....E#', '#########'],
        [{ path: [{ x: 6.5, y: 1.5 }, { x: 5.5, y: 1.5 }], speed: 0.3 }],
      ),
      hard,
    );

  it('being seen is fatal at once (no meter to fill)', () => {
    const w = corridor(true);
    let frames = 0;
    // guard turns to face west during its first wait, then sees the player standing still at range 5
    while (w.status === 'playing' && frames < 600) {
      w.step(1 / 60, { x: 0, y: 0 }, false);
      frames++;
    }
    expect(w.status).toBe('caught');
    // normal mode needs noticeably longer for the same exposure
    const n = corridor(false);
    let nf = 0;
    while (n.status === 'playing' && nf < 1200) {
      n.step(1 / 60, { x: 0, y: 0 }, false);
      nf++;
    }
    expect(n.status).toBe('caught');
    expect(nf).toBeGreaterThan(frames);
  });

  it('has no cooldown but a limited number of switches', () => {
    const def = { ...room(BOX), hardSwitches: 3 };
    const w = new GameWorld(def, true);
    expect(w.vision.switchesLeft).toBe(3);
    for (let i = 0; i < 3; i++) {
      const ev = w.step(1 / 60, { x: 0, y: 0 }, true); // back-to-back, no waiting
      expect(ev.toggled).toBe(true);
    }
    expect(w.vision.switchesLeft).toBe(0);
    const mode = w.vision.mode;
    const ev = w.step(1 / 60, { x: 0, y: 0 }, true);
    expect(ev.toggled).toBe(false);
    expect(ev.toggleDenied).toBe(true);
    expect(w.vision.mode).toBe(mode);
  });

  it('normal mode keeps unlimited switches and the cooldown', () => {
    const w = new GameWorld(room(BOX), false);
    expect(w.vision.switchesLeft).toBe(Infinity);
    expect(w.step(1 / 60, { x: 0, y: 0 }, true).toggled).toBe(true);
    expect(w.step(1 / 60, { x: 0, y: 0 }, true).toggleDenied).toBe(true);
  });

  it('stores best times per mode', () => {
    const m = new Map<string, string>();
    const s = new SaveSystem({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    s.completeLevel(0, 10, 6, false);
    s.completeLevel(0, 20, 6, true);
    expect(s.data.best['0']).toBe(10);
    expect(s.data.best['h0']).toBe(20);
    expect(new SaveSystem({ getItem: (k) => m.get(k) ?? null, setItem: () => undefined }).data.best['h0']).toBe(20);
  });
});
