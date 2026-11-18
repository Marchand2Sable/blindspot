import { campaign, CLASSIC } from '../levels';
import { GUARD_KINDS, HARDCORE_SWITCHES, type GuardKind } from '../core/constants';
import type { LevelDef } from '../core/types';
import { Renderer, type Bump, type FxState } from '../render/Renderer';
import { guardAt } from '../systems/guard';
import { UIController } from '../ui/UIController';
import { Tutorial } from '../ui/Tutorial';
import { TUTORIAL } from '../levels/tutorial';
import { AudioManager } from './AudioManager';
import { GameWorld } from './GameWorld';
import { InputController } from './InputController';
import { SaveSystem } from './SaveSystem';

type Mode = 'menu' | 'playing' | 'paused' | 'ending';

/**
 * GameEngine — orchestrates loop, screens, input, audio, save and the world.
 * All rules live in GameWorld; this class only wires things together.
 */
export class GameEngine {
  private renderer: Renderer;
  private ui: UIController;
  private input: InputController;
  private audio = new AudioManager();
  private save = new SaveSystem();
  private world: GameWorld;
  private mode: Mode = 'menu';
  private levelIndex = 0;
  private toggleQueued = false;
  private last = performance.now();
  private now = 0;
  private fx: FxState = { now: 0, bumps: [], shake: 0, reducedMotion: false };
  private demoTimer = 0;
  private endTimer = 0;
  private lastBump = 0;
  private hardcore = false;
  /** Level 0: while set, the world is the tutorial level and the tutorial drives freezing / safety. */
  private tutorial: Tutorial | null = null;
  private tutorialFrozen = false;

  /** Definition of the level on screen (the tutorial is not part of a campaign). */
  private get def(): LevelDef {
    return this.tutorial ? TUTORIAL : this.levels[this.levelIndex];
  }

  /** Levels of the campaign matching the current mode. */
  private get levels(): LevelDef[] {
    return campaign(this.hardcore);
  }

  constructor() {
    this.renderer = new Renderer(document.getElementById('game') as HTMLCanvasElement);
    this.audio.enabled = this.save.data.settings.sound;
    this.audio.volume = this.save.data.settings.volume;
    this.fx.reducedMotion = this.save.data.settings.reducedMotion;
    this.world = this.makeDemo();
    this.hardcore = this.save.data.settings.hardcore;

    this.ui = new UIController(() => this.levels, {
      setHardcore: (on) => {
        this.hardcore = on;
        this.ui.hardcore = on;
        this.save.data.settings.hardcore = on;
        this.save.save();
        if (this.ui.visible === 'levels') this.openLevels();
        else this.ui.show('title');
      },
      play: () => {
        const fresh = !this.save.data.tutorialDone && this.save.data.unlocked <= 1 && Object.keys(this.save.data.best).length === 0;
        if (fresh) this.startTutorial();
        else this.startLevel(Math.min(this.save.unlockedFor(this.hardcore), this.levels.length) - 1);
      },
      tutorial: () => this.startTutorial(),
      openLevels: () => this.openLevels(),
      startLevel: (i) => this.startLevel(i),
      next: () => this.startLevel(Math.min(this.levelIndex + 1, this.levels.length - 1)),
      retry: () => (this.tutorial ? this.startTutorial() : this.startLevel(this.levelIndex)),
      resume: () => this.resume(),
      menu: () => this.toMenu(),
      pause: () => this.pause(),
      setSound: (on) => {
        this.save.data.settings.sound = on;
        this.save.save();
        this.audio.setEnabled(on);
      },
      setVolume: (v) => {
        this.save.data.settings.volume = v;
        this.save.save();
        this.audio.setVolume(v);
      },
      openSettings: (fromPause) => this.showSettings(fromPause),
      setReducedMotion: (on) => {
        this.save.data.settings.reducedMotion = on;
        this.save.save();
        this.fx.reducedMotion = on;
      },
      resetSave: () => {
        this.save.reset();
        this.audio.setEnabled(true);
        this.showSettings();
      },
      sfxClick: () => {
        this.audio.unlock();
        this.audio.click();
      },
    });

    this.input = new InputController(
      {
        onToggle: () => {
          this.audio.unlock();
          this.toggleQueued = true;
        },
        onPause: () => (this.mode === 'playing' ? this.pause() : this.mode === 'paused' ? this.resume() : undefined),
        onRestart: () => {
          // same action as the Recommencer / Réessayer buttons: works while playing, paused, during the
          // end transition and from the Repéré / win screens (the scene is then in the 'menu' mode)
          const onEndScreen = this.ui.visible === 'fail' || this.ui.visible === 'win';
          if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'ending' || onEndScreen) {
            if (this.tutorial) this.startTutorial();
            else this.startLevel(this.levelIndex);
          }
        },
      },
      document.getElementById('joy-zone') as HTMLElement,
      document.getElementById('joy-base') as HTMLElement,
      document.getElementById('joy-knob') as HTMLElement,
      document.getElementById('btn-vision') as HTMLElement,
    );

    this.ui.hardcore = this.hardcore;
    this.ui.show('title');
    // Expose for automated tests / debugging.
    (window as unknown as { __blindspot: unknown }).__blindspot = this;
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Read-only snapshot for e2e checks. */
  get debug() {
    const w = this.world;
    return {
      mode: this.mode,
      level: this.levelIndex,
      status: w.status,
      vision: w.vision.mode,
      blend: w.vision.blend,
      cooldownLeft: w.vision.cooldownLeft,
      hardcore: w.hardcore,
      switchesLeft: w.vision.switchesLeft,
      meter: w.detection.meter,
      player: { x: w.player.x, y: w.player.y },
      guards: w.guards.map((g) => ({ x: g.x, y: g.y, angle: g.angle })),
      time: w.time,
      save: this.save.data,
    };
  }

  private makeDemo(): GameWorld {
    const w = new GameWorld({ ...CLASSIC[0], cooldown: 0.01 });
    w.player.x = 3.5;
    w.player.y = 4.5;
    return w;
  }

  /** LEVEL 0 — interactive tutorial. */
  private startTutorial(): void {
    this.endTutorial();
    this.hardcore = false;
    this.ui.hardcore = false;
    this.levelIndex = -1;
    this.world = new GameWorld(TUTORIAL, false);
    this.world.safe = true;
    this.mode = 'playing';
    this.toggleQueued = false;
    this.fx.bumps = [];
    this.fx.shake = 0;
    this.input.clear();
    this.ui.show(null);
    this.ui.showHud(true);
    this.ui.hideToast();
    this.audio.unlock();
    this.audio.startAmbience();
    this.audio.setAmbienceMode('day');
    this.tutorial = new Tutorial({
      world: () => this.world,
      tileRect: (a, b, c, d) => this.renderer.tileRect(a, b, c, d),
      mapBox: (dock) => this.renderer.mapBox(this.world, dock),
      setDock: (px) => (this.renderer.dockBottom = px),
      setFrozen: (on) => (this.tutorialFrozen = on),
      setSafe: (on) => (this.world.safe = on),
      finish: () => {
        this.save.data.tutorialDone = true;
        this.save.save();
        this.endTutorial();
        this.startLevel(Math.min(this.save.unlockedFor(this.hardcore), this.levels.length) - 1);
      },
      replay: () => this.startTutorial(),
      menu: () => {
        if (this.tutorial?.done) {
          this.save.data.tutorialDone = true;
          this.save.save();
        }
        this.toMenu();
      },
    });
    this.syncHud();
  }

  private endTutorial(): void {
    this.tutorial?.destroy();
    this.tutorial = null;
    this.renderer.dockBottom = 0;
    this.tutorialFrozen = false;
  }

  private startLevel(i: number): void {
    this.endTutorial();
    this.levelIndex = i;
    this.world = new GameWorld(this.levels[i], this.hardcore);
    this.mode = 'playing';
    this.toggleQueued = false;
    this.fx.bumps = [];
    this.fx.shake = 0;
    this.input.clear();
    this.ui.show(null);
    this.ui.showHud(true);
    this.ui.hideToast();
    this.ui.toast(
      this.hardcore
        ? `HARDCORE — un seul regard te perd. ${this.world.vision.switchesLeft} bascules, pas de cooldown.`
        : this.levels[i].hint,
    );
    this.audio.unlock();
    this.audio.startAmbience();
    this.audio.setAmbienceMode('day');
    this.syncHud();
  }

  private openLevels(): void {
    this.endTutorial();
    const d: Record<string, string> = { unlocked: String(this.save.unlockedFor(this.hardcore)) };
    d.tutorial = this.save.data.tutorialDone ? '1' : '0';
    this.levels.forEach((_, i) => {
      const v = this.save.data.best[SaveSystem.bestKey(i, this.hardcore)];
      if (v !== undefined) d[`best${i}`] = String(v);
    });
    if (this.mode !== 'menu') this.mode = 'menu';
    this.ui.showHud(false);
    this.ui.hideToast();
    this.ui.show('levels', d);
  }

  private showSettings(fromPause = false): void {
    this.ui.show('settings', {
      from: fromPause ? 'pause' : '',
      volume: String(Math.round(this.save.data.settings.volume * 100)),
      sound: this.save.data.settings.sound ? '1' : '0',
      motion: this.save.data.settings.reducedMotion ? '1' : '0',
    });
  }

  private toMenu(): void {
    this.endTutorial();
    this.mode = 'menu';
    this.world = this.makeDemo();
    this.ui.showHud(false);
    this.ui.hideToast();
    this.ui.show('title');
  }

  private pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.clear();
    this.ui.show('pause');
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.show(null);
  }

  private syncHud(): void {
    const v = this.world.vision;
    this.ui.updateHud({
      levelIndex: this.levelIndex,
      name: this.def.name,
      mode: v.mode,
      ready: v.ready,
      cooldownRatio: v.cooldownRatio,
      secondsLeft: v.cooldownLeft,
      hardcore: this.world.hardcore,
      switchesLeft: v.switchesLeft,
      switchesMax: this.def.hardSwitches ?? HARDCORE_SWITCHES,
      kinds: (Object.keys(GUARD_KINDS) as GuardKind[]).filter((k) => this.def.guards.some((g) => (g.kind ?? 'normal') === k)),
    });
  }

  private frame(t: number): void {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.now += dt;
    this.fx.now = this.now;

    // visual-only decay
    this.fx.bumps = this.fx.bumps.filter((b) => (b.age += dt) < 0.7);
    this.fx.shake = Math.max(0, this.fx.shake - dt * 40);

    if (this.mode === 'playing') this.updatePlaying(dt);
    else if (this.mode === 'ending') this.updateEnding(dt);
    else if (this.mode === 'menu') this.updateDemo(dt);

    this.renderer.draw(this.world, this.fx);
    requestAnimationFrame((n) => this.frame(n));
  }

  private updatePlaying(dt: number): void {
    const w = this.world;
    const wantToggle = this.toggleQueued;
    this.toggleQueued = false;
    if (this.tutorial && (this.tutorialFrozen || this.tutorial.done)) {
      // explanation step: nothing moves, the vision cross-fade still plays
      w.vision.update(dt);
      this.tutorial.update(dt);
      this.syncHud();
      return;
    }
    const ev = w.step(dt, this.input.getMove(), wantToggle);

    if (ev.toggled) {
      this.audio.switchVision(w.vision.mode);
      this.audio.setAmbienceMode(w.vision.mode);
      this.ui.hideToast();
    }
    if (ev.toggleDenied) {
      this.audio.denied();
      this.ui.denied();
      if (w.hardcore && w.vision.switchesLeft <= 0) {
        this.ui.toast(`Plus de bascule : tu restes en ${w.vision.mode === 'day' ? 'JOUR' : 'NUIT'} jusqu’à la fin du niveau.`, 2800);
      }
    }
    // Hardcore: touching a wall gives NO feedback (no flash, no sound) — you must remember the map.
    if (ev.bump && !w.hardcore && this.now - this.lastBump > 0.25) {
      this.lastBump = this.now;
      this.audio.bump();
      this.addBump(ev.bump.nx, ev.bump.ny);
    }
    if (w.detection.meter > 0.02 && w.status === 'playing') this.audio.alert(w.detection.meter, this.now);

    this.syncHud();

    if (this.tutorial) {
      if (w.status === 'won' && !this.tutorial.atLastStep) {
        // reached the exit before the lesson got there: put the player back, keep the current step
        const keep = this.world;
        this.world = new GameWorld(TUTORIAL, false);
        this.world.safe = keep.safe;
        this.world.vision.mode = keep.vision.mode;
        this.world.vision.blend = keep.vision.blend;
        this.world.vision.cooldownLeft = 0;
        this.ui.toast('Pas si vite : suis d’abord les étapes du tutoriel.', 2600);
        return;
      }
      this.tutorial.update(dt);
      if (w.status === 'caught') this.tutorialCaught();
      return;
    }
    if (w.status === 'caught') this.finish(false);
    else if (w.status === 'won') this.finish(true);
  }

  /** Tutorial crossing failed: back to the start of the crossing, with a hint, no penalty screen. */
  private tutorialCaught(): void {
    this.audio.caught();
    const mode = this.world.vision.mode;
    this.world = new GameWorld(TUTORIAL, false);
    this.world.safe = false;
    this.world.vision.cooldownLeft = 0;
    this.world.vision.mode = mode;
    this.world.vision.blend = mode === 'night' ? 1 : 0;
    this.tutorial?.caught();
    this.ui.toast('Repéré ! Tu repars du début : observe la ronde en NUIT avant d’avancer.', 3800);
  }

  private addBump(nx: number, ny: number): void {
    const p = this.world.player;
    const cx = Math.floor(p.x + nx * 0.5);
    const cy = Math.floor(p.y + ny * 0.5);
    const b: Bump = { cx, cy, age: 0 };
    this.fx.bumps.push(b);
    if (this.fx.bumps.length > 4) this.fx.bumps.shift();
  }

  private finish(won: boolean): void {
    this.mode = 'ending';
    this.endTimer = 0;
    this.input.clear();
    if (won) this.audio.win();
    else {
      this.audio.caught();
      this.fx.shake = 14;
    }
  }

  private updateEnding(dt: number): void {
    this.endTimer += dt;
    this.world.vision.update(dt);
    if (this.endTimer < (this.world.status === 'won' ? 0.7 : 0.9)) return;
    this.mode = 'menu'; // screens are modal; 'menu' keeps the scene alive behind them
    this.ui.showHud(false);
    if (this.world.status === 'won') {
      const time = this.world.time;
      const prev = this.save.data.best[SaveSystem.bestKey(this.levelIndex, this.hardcore)];
      const record = prev === undefined || time < prev;
      this.save.completeLevel(this.levelIndex, time, this.levels.length, this.hardcore);
      if (this.levelIndex === this.levels.length - 1) this.ui.show('end');
      else {
        this.ui.show('win', {
          chapter: `Chapitre ${String(this.levelIndex + 1).padStart(2, '0')}`,
          name: this.levels[this.levelIndex].name,
          time: `${time.toFixed(1)} s`,
          record: record ? '1' : '0',
        });
      }
    } else {
      const by = this.world.caughtBy;
      const kind = by >= 0 ? this.world.routes[by].kind : undefined;
      const v = this.world.vision;
      this.ui.show('fail', {
        kind: kind ?? '',
        noSwitch: this.world.hardcore && v.switchesLeft <= 0 ? '1' : '0',
        mode: v.mode,
      });
    }
  }

  /** Title-screen scene: level 1 breathing, vision alternating by itself. */
  private updateDemo(dt: number): void {
    const w = this.world;
    if (w.level.def.id !== CLASSIC[0].id || w.status !== 'playing') return;
    this.demoTimer += dt;
    if (this.demoTimer > 3.6) {
      this.demoTimer = 0;
      w.vision.cooldownLeft = 0;
      w.vision.toggle();
    }
    w.vision.update(dt);
    w.time += dt;
    w.guards = w.routes.map((r) => guardAt(r, w.time));
  }
}
