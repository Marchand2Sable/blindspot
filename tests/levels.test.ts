import { describe, expect, it } from 'vitest';
import { CLASSIC, HARDCORE } from '../src/levels';
import type { LevelDef } from '../src/core/types';
import { validateLevel, MARGIN_LADDER, STEP } from '../src/systems/validator';
import { GameWorld } from '../src/engine/GameWorld';
import { PLAYER_SPEED } from '../src/core/constants';
import { buildRoute, guardAt } from '../src/systems/guard';
import { isWall, parseLevel } from '../src/systems/grid';
import { layoutSimilarity, cooldownPressure, measure } from '../src/systems/metrics';
import { dangerCells, dangerRuns, freeRoute, hasAlternativeRoute, startCheck, MIN_FIRST_SEEN } from '../src/systems/audit';
import { GUARD_KINDS, type GuardKind } from '../src/core/constants';

// The validator is the expensive part: solve each level once per margin rung.
const cache = new Map<string, ReturnType<typeof validateLevel>>();
const solve = (def: LevelDef, rung = 0) => {
  const k = `${def.id}|${rung}`;
  let r = cache.get(k);
  if (!r) {
    r = validateLevel(def, MARGIN_LADDER[rung]);
    cache.set(k, r);
  }
  return r;
};

const CAMPAIGNS: [string, LevelDef[], boolean][] = [
  ['CLASSIC', CLASSIC, false],
  ['HARDCORE', HARDCORE, true],
];

describe('campaign structure', () => {
  it('both campaigns exist and ids are unique', () => {
    expect(CLASSIC.length).toBeGreaterThanOrEqual(1);
    expect(HARDCORE.length).toBeGreaterThanOrEqual(1);
    const ids = [...CLASSIC, ...HARDCORE].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CAMPAIGNS)('%s difficulty targets never go down by more than 1', (_n, levels) => {
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].target).toBeGreaterThanOrEqual(levels[i - 1].target - 1);
    }
  });

  it('no two levels share almost the same layout (anti-repetition, Jaccard of interior walls < 0.7)', () => {
    const all = [...CLASSIC, ...HARDCORE];
    const offenders: string[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const s = layoutSimilarity(all[i], all[j]);
        if (s >= 0.7) offenders.push(`${all[i].id}~${all[j].id}=${s.toFixed(2)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe.each(CAMPAIGNS)('%s levels', (_name, levels, hard) => {
  describe.each(levels)('level $id ($name)', (def) => {
    it('has complete metadata', () => {
      expect(def.intent.length).toBeGreaterThan(20);
      expect(def.hint.length).toBeGreaterThan(10);
      expect(def.target).toBeGreaterThanOrEqual(1);
      expect(def.target).toBeLessThanOrEqual(10);
      expect(def.cooldown).toBeGreaterThan(0);
      if (hard) expect(def.hardSwitches ?? 4).toBeGreaterThanOrEqual(2);
    });

    it('parses (closed rectangle, one start, one exit) and guard routes never cross walls', () => {
      const level = parseLevel(def);
      expect(level.width).toBeGreaterThan(3);
      expect(def.guards.length).toBeGreaterThan(0);
      for (const g of def.guards) {
        const route = buildRoute(g);
        for (let t = 0; t < route.period; t += 0.05) {
          const s = guardAt(route, t);
          expect(isWall(level, Math.floor(s.x), Math.floor(s.y))).toBe(false);
        }
      }
    });

    it('is solvable by a never-detected route', () => {
      expect(solve(def).solvable).toBe(true);
    });

    it('is not trivial: the best route needs at least 1.5 s of waiting', () => {
      expect(solve(def).waitTime).toBeGreaterThanOrEqual(1.5);
    });

    it('is fair: still solvable with one extra rung of safety margins', () => {
      expect(solve(def, 1).solvable).toBe(true);
    });

    it(`reference solution wins in the real game (continuous physics, ${hard ? 'hardcore' : 'classic'} rules)`, () => {
      const r = solve(def);
      expect(r.solvable).toBe(true);
      const w = new GameWorld(def, hard);
      const dt = 1 / 60;
      for (let k = 1; k < r.path.length && w.status === 'playing'; k++) {
        const target = r.path[k];
        const tEnd = k * STEP;
        while (w.time < tEnd - 1e-9 && w.status === 'playing') {
          const remaining = Math.max(dt, tEnd - w.time);
          const dx = target.x - w.player.x;
          const dy = target.y - w.player.y;
          const d = Math.hypot(dx, dy);
          const speed = Math.min(1, d / (remaining * PLAYER_SPEED));
          const move = d > 1e-6 ? { x: (dx / d) * speed, y: (dy / d) * speed } : { x: 0, y: 0 };
          w.step(dt, move, false);
        }
      }
      expect(w.status).toBe('won');
    });
  });
});

describe('cooldown-pressure levels', () => {
  // At least two CLASSIC levels are built so the guarded route outlasts the cooldown and is full of turns:
  // you cannot re-check the guards while following the route (see cooldownPressure in metrics.ts).
  it('at least two CLASSIC levels keep a guarded route that outlasts the cooldown', () => {
    const hits = CLASSIC.filter((def) => {
      const p = cooldownPressure(def, solve(def).path);
      return p.ratio >= 1.5 && p.turns >= 3;
    });
    expect(hits.map((l) => l.id).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------------------------
// DESIGN CONTRACT — measured guard-rails against known level-design failures (see docs/LEVELS.md).
// ---------------------------------------------------------------------------------------------
const refPath = (def: LevelDef) => solve(def).path;
const fast = new Map<string, ReturnType<typeof measure>>();
const score = (def: LevelDef) => {
  let m = fast.get(def.id);
  if (!m) fast.set(def.id, (m = measure(def, false)));
  return m.score;
};

describe.each(CAMPAIGNS)('%s design contract', (_name, levels, hard) => {
  it('no level can be crossed without being exposed to the guards (the NIGHT view is always needed)', () => {
    const bypass = levels.filter((l) => freeRoute(l, dangerCells(l)) > 0).map((l) => l.id);
    expect(bypass).toEqual([]);
  });

  it('first seconds are fair: no sight of the start cell before MIN_FIRST_SEEN, no guard close to the start', () => {
    const bad = levels.map((l) => ({ id: l.id, ...startCheck(l) })).filter((s) => s.firstSeen < MIN_FIRST_SEEN || s.minDist < 2).map((s) => `${s.id}(seen ${s.firstSeen.toFixed(2)}s, dist ${s.minDist.toFixed(1)})`);
    expect(bad).toEqual([]);
  });

  it('guards follow their kind: speed inside the kind band, no range/cone overrides', () => {
    const bad: string[] = [];
    for (const l of levels) {
      l.guards.forEach((g, i) => {
        const k = GUARD_KINDS[g.kind ?? 'normal'];
        if (g.range !== undefined || g.fov !== undefined) bad.push(`${l.id}#${i} override`);
        if (g.speed < k.speedMin - 1e-9 || g.speed > k.speedMax + 1e-9) bad.push(`${l.id}#${i} speed ${g.speed} (${g.kind ?? 'normal'})`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('heavy and light guards each appear in at least 3 levels, and their first level announces them in its intent', () => {
    for (const kind of ['heavy', 'light'] as GuardKind[]) {
      const withKind = levels.filter((l) => l.guards.some((g) => g.kind === kind));
      expect(withKind.length, kind).toBeGreaterThanOrEqual(3);
      expect(withKind[0].intent.toLowerCase(), `${kind} intro`).toContain(kind === 'heavy' ? 'lourd' : 'léger');
    }
  });

  it('difficulty never starts trivial and keeps rising (score floors, no big drop)', () => {
    const floor = (i: number) => (hard ? 9 + 0.8 * i : 7.5 + 0.55 * i);
    const low = levels.map((l, i) => ({ id: l.id, s: score(l), f: floor(i) })).filter((x) => x.s < x.f).map((x) => `${x.id} ${x.s}<${x.f.toFixed(1)}`);
    expect(low).toEqual([]);
    for (let i = 1; i < levels.length; i++) expect(score(levels[i]), levels[i].id).toBeGreaterThanOrEqual(score(levels[i - 1]) - 3);
  });

  it('a good share of levels offer a genuinely different route (block the middle of the reference route, still solvable)', () => {
    const alt = levels.filter((l) => hasAlternativeRoute(l, solve(l))).length;
    expect(alt / levels.length).toBeGreaterThanOrEqual(hard ? 0.3 : 0.4);
  });

  if (hard) {
    it('every switch budget is justified and consistent with the level', () => {
      for (const l of levels) {
        const n = l.hardSwitches ?? 4;
        expect(l.switchWhy?.length ?? 0, l.id).toBeGreaterThan(30);
        expect(n, l.id).toBeGreaterThanOrEqual(2);
        const runs = dangerRuns(l, refPath(l));
        expect(n, `${l.id} budget vs ${runs} danger runs`).toBeLessThanOrEqual(2 + Math.max(2, runs));
      }
      // the first levels are tight: a switch is a precious resource from the start
      for (const l of levels.slice(0, 3)) expect(l.hardSwitches ?? 4, l.id).toBeLessThanOrEqual(3);
    });
  }
});
