import type { GameWorld } from '../engine/GameWorld';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The map on screen and the band between the HUD (`top`) and the controls (`bottom`). */
export interface MapBox extends Rect {
  top: number;
  bottom: number;
}

/** What the tutorial needs from the engine (keeps this module free of engine imports). */
export interface TutorialHost {
  world(): GameWorld;
  /** Tile rectangle -> screen pixels. */
  tileRect(x0: number, y0: number, x1: number, y1: number): Rect;
  /** Where the map would be with `dock` extra pixels reserved at the bottom (nothing changes). */
  mapBox(dock: number): MapBox;
  /** Reserve pixels at the bottom of the screen: the map shrinks to leave room for the card. */
  setDock(px: number): void;
  /** Freeze / unfreeze the simulation (guards, timers). */
  setFrozen(on: boolean): void;
  /** Guards cannot catch the player while true (explanations); false for the final crossing. */
  setSafe(on: boolean): void;
  finish(): void;
  replay(): void;
  menu(): void;
}

/** Finds the first visible element among the selectors and gives its screen rectangle. */
type Dom = (selectors: string[]) => Rect | null;

interface Step {
  title: string;
  text: (touch: boolean) => string;
  /** Rectangle to highlight (null: nothing). */
  target: ((h: TutorialHost, dom: Dom) => Rect | null) | null;
  frozen: boolean;
  safe: boolean;
  /** Action the player must perform: the step then moves on by itself. Without it, "Suivant" is shown. */
  needs?: (w: GameWorld, stepTime: number) => boolean;
  needsLabel?: (touch: boolean, w: GameWorld) => string;
}

const pad = 10;
const GAP = 14;
const ADVANCE_DELAY = 0.7; // seconds the "done" tick stays before the next step
const VISION_BTN = ['#btn-vision', '#keys .wide', '#hud-vision'];

const exitRect = (h: TutorialHost): Rect => {
  const e = h.world().level.exit;
  return h.tileRect(Math.floor(e.x) - 0.2, Math.floor(e.y) - 0.2, Math.floor(e.x) + 1.2, Math.floor(e.y) + 1.2);
};

/**
 * Tutorial — LEVEL 0. Five short steps on the real level: one explanation, then three things to do
 * (they chain by themselves, nothing to click), then the real crossing. The card never covers the map:
 * it takes the free room beside or under it and, when the screen is too small for that, the map is
 * shrunk to leave a band for the card (see placeCard).
 */
export class Tutorial {
  private root: HTMLElement;
  private hole: HTMLElement;
  private card: HTMLElement;
  private idx = 0;
  private stepTime = 0;
  private doneTime = 0;
  private satisfied: boolean[] = [];
  private completed = false;
  private raf = 0;
  private lastKey = '';
  private touch = window.matchMedia('(pointer: coarse)').matches;

  private readonly steps: Step[] = [
    {
      title: 'Atteindre la sortie',
      text: () => 'Rejoins la sortie (le chevron) sans te faire repérer. En vision JOUR tu vois les murs, mais pas les gardes : ils sont bien là.',
      target: exitRect,
      frozen: true,
      safe: true,
    },
    {
      title: 'Passer en NUIT',
      text: (t) => `Passe en vision NUIT (${t ? 'bouton rond en bas à droite' : 'ESPACE'}). Les murs disparaissent, le garde et son cône de vision apparaissent : observe sa ronde.`,
      target: (h, dom) => {
        const w = h.world();
        if (w.vision.mode !== 'night') return dom(VISION_BTN);
        const g = w.guards[0];
        return h.tileRect(g.x - 1.4, g.y - 1.4, g.x + 1.4, g.y + 1.4);
      },
      frozen: false,
      safe: true,
      needs: (w, t) => w.vision.mode === 'night' && t >= 3,
      needsLabel: (touch, w) => (w.vision.mode === 'night' ? 'Observe la ronde du garde…' : touch ? 'Touche le bouton Jour/Nuit' : 'Appuie sur ESPACE'),
    },
    {
      title: 'Revenir en JOUR',
      text: (t) => `Repasse en JOUR (${t ? 'bouton rond' : 'ESPACE'}) pour relire les murs. Après chaque bascule la vision se recharge quelques secondes : surveille la barre en haut.`,
      target: (_h, dom) => dom(VISION_BTN),
      frozen: false,
      safe: true,
      needs: (w) => w.vision.mode === 'day',
      needsLabel: (touch) => (touch ? 'Touche le bouton Jour/Nuit' : 'Appuie sur ESPACE'),
    },
    {
      title: 'Se déplacer',
      text: (t) => `${t ? 'Pose le pouce à gauche et glisse' : 'Utilise ZQSD, WASD ou les flèches'} pour traverser l’ouverture du mur central.`,
      target: (h) => {
        const p = h.world().player;
        return h.tileRect(p.x - 0.8, p.y - 0.8, p.x + 0.8, p.y + 0.8);
      },
      frozen: false,
      safe: true,
      needs: (w) => w.player.x > 7.2,
      needsLabel: () => 'Passe de l’autre côté du mur',
    },
    {
      title: 'À toi de jouer',
      text: () => 'Le cône est ce que voit le garde : y rester te fait repérer. Observe la ronde en NUIT, passe quand il s’éloigne, puis atteins la sortie. Cette fois, il te voit pour de bon.',
      target: exitRect,
      frozen: false,
      safe: false,
      needs: (w) => w.status === 'won',
      needsLabel: () => 'Atteins la sortie',
    },
  ];

  constructor(private host: TutorialHost) {
    this.root = document.createElement('div');
    this.root.id = 'tutorial';
    this.root.className = 'tut';
    this.root.innerHTML = '<div class="tut-hole"></div><div class="tut-card" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(this.root);
    this.hole = this.root.querySelector('.tut-hole') as HTMLElement;
    this.card = this.root.querySelector('.tut-card') as HTMLElement;
    this.card.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tut]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      const a = el.dataset.tut;
      if (a === 'next') this.go(this.idx + 1);
      else if (a === 'skip' || a === 'menu') this.host.menu();
      else if (a === 'play') this.host.finish();
      else if (a === 'replay') this.host.replay();
    });
    window.addEventListener('resize', this.onResize);
    this.go(0);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  /** Whether the engine should freeze the simulation right now. */
  get frozen(): boolean {
    return this.completed || this.steps[this.idx].frozen;
  }

  /** True on the final "À toi de jouer" step, the only one where reaching the exit counts. */
  get atLastStep(): boolean {
    return this.idx === this.steps.length - 1;
  }

  get done(): boolean {
    return this.completed;
  }

  private onResize = (): void => (this.completed ? this.centerCard() : this.placeCard());

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.raf);
    this.host.setDock(0);
    this.root.remove();
  }

  /** Called by the engine every frame with the elapsed time (only counts while unfrozen steps run). */
  update(dt: number): void {
    if (this.completed) return;
    const s = this.steps[this.idx];
    if (!s.frozen) this.stepTime += dt;
    if (s.needs && !this.satisfied[this.idx] && s.needs(this.host.world(), this.stepTime)) {
      this.satisfied[this.idx] = true;
      this.doneTime = 0;
      // the last step finishes the tutorial as soon as the exit is reached
      if (this.atLastStep) this.complete();
      else this.render(true);
    } else if (this.satisfied[this.idx] && !this.atLastStep) {
      // action done: show the tick for a moment, then move on without a click
      this.doneTime += dt;
      if (this.doneTime >= ADVANCE_DELAY) this.go(this.idx + 1);
    }
    // the label of an action step can change while it runs (e.g. night reached, now observe)
    if (!this.satisfied[this.idx]) this.render();
  }

  /** The player was caught during the last crossing: reset is done by the engine, we just keep the step. */
  caught(): void {
    this.stepTime = 0;
    this.satisfied[this.idx] = false;
  }

  private go(i: number): void {
    if (i < 0 || i >= this.steps.length) return;
    this.idx = i;
    this.stepTime = 0;
    this.doneTime = 0;
    const s = this.steps[i];
    this.host.setFrozen(s.frozen);
    this.host.setSafe(s.safe);
    this.lastKey = '';
    this.render(true);
  }

  private complete(): void {
    this.completed = true;
    this.host.setFrozen(true);
    this.host.setSafe(true);
    this.host.setDock(0);
    this.hole.style.display = 'none';
    this.root.classList.add('tut-end');
    this.card.innerHTML = `
      <p class="micro">Tutoriel terminé</p>
      <h3>Tu connais les règles</h3>
      <p>Le jour montre les murs, la nuit montre les gardes, jamais les deux. Observe, mémorise, puis traverse.</p>
      <div class="tut-actions">
        <button class="tut-btn primary" data-tut="play">Commencer la campagne</button>
        <button class="tut-btn" data-tut="replay">Rejouer le tutoriel</button>
        <button class="tut-link" data-tut="menu">Menu principal</button>
      </div>`;
    this.centerCard();
  }

  private centerCard(): void {
    const cw = Math.min(360, window.innerWidth - 24);
    this.card.style.width = `${cw}px`;
    const ch = this.card.offsetHeight;
    this.card.style.transform = `translate(${Math.round((window.innerWidth - cw) / 2)}px, ${Math.max(8, Math.round((window.innerHeight - ch) / 2))}px)`;
  }

  private render(force = false): void {
    const s = this.steps[this.idx];
    const w = this.host.world();
    const ok = !s.needs || this.satisfied[this.idx];
    const need = s.needs && !ok ? (s.needsLabel?.(this.touch, w) ?? 'Fais l’action pour continuer') : '';
    const key = `${this.idx}|${ok}|${need}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const dots = this.steps.map((_, i) => `<i class="${i === this.idx ? 'on' : i < this.idx ? 'past' : ''}"></i>`).join('');
    const status = s.needs ? (ok ? '<p class="tut-need ok">Bien joué</p>' : `<p class="tut-need">${need}</p>`) : '';
    this.card.innerHTML = `
      <div class="tut-head"><span class="micro">Tutoriel · ${this.idx + 1} / ${this.steps.length}</span><span class="tut-dots" aria-hidden="true">${dots}</span></div>
      <h3>${s.title}</h3>
      <p>${s.text(this.touch)}</p>
      ${status}
      <div class="tut-actions">
        <button class="tut-link tut-skip" data-tut="skip">Quitter</button>
        ${s.needs ? '' : '<button class="tut-btn primary" data-tut="next">Suivant</button>'}
      </div>`;
    this.placeCard();
  }

  private domRect: Dom = (sels) => {
    for (const sel of sels) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && getComputedStyle(el).display !== 'none') return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return null;
  };

  private loop(): void {
    if (!this.completed) this.place();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  /** Position the highlight (every frame: targets such as the guard move). */
  private place(): void {
    const r = this.steps[this.idx].target?.(this.host, this.domRect) ?? null;
    if (r) {
      this.hole.style.display = 'block';
      this.hole.style.transform = `translate(${r.x - pad}px, ${r.y - pad}px)`;
      this.hole.style.width = `${r.w + pad * 2}px`;
      this.hole.style.height = `${r.h + pad * 2}px`;
    } else {
      this.hole.style.display = 'none';
    }
  }

  /**
   * Card position, computed once per step (and on resize) so its buttons never move under the pointer.
   * It must never hide the map, the HUD or the controls. In order of preference:
   *   1. beside the map, when there is room on a side (wide screens, phones in landscape);
   *   2. in the free band under, then over, the map;
   *   3. in a band reserved at the bottom: the map is shrunk (host.setDock) to leave room for the card.
   */
  private placeCard(): void {
    if (this.completed) return this.centerCard();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.card.classList.toggle('compact', vh < 560);
    const box = this.host.mapBox(0);
    const place = (cw: number, x: number, y: number): void => {
      this.card.style.width = `${cw}px`;
      this.card.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(8, Math.min(y, vh - this.card.offsetHeight - 8)))}px)`;
    };
    const fit = (cw: number): number => {
      this.card.style.width = `${cw}px`;
      return this.card.offsetHeight;
    };
    const sideR = vw - (box.x + box.w);
    const sideL = box.x;
    const sideW = (room: number): number => Math.min(340, room - GAP * 2);
    const bandTop = box.top;
    const bandBottom = box.bottom;
    const midY = box.y + box.h / 2;

    // 1. a side
    for (const side of [sideR, sideL] as const) {
      const cw = sideW(side);
      if (cw >= 240) {
        const ch = fit(cw);
        if (ch <= bandBottom - bandTop || ch <= vh - 16) {
          const x = side === sideR ? box.x + box.w + (side - cw) / 2 : (side - cw) / 2;
          this.host.setDock(0);
          place(cw, x, Math.max(bandTop, Math.min(midY - ch / 2, bandBottom - ch)));
          return;
        }
      }
    }
    // 2. under / over the map
    const cw = Math.min(360, vw - 24);
    const ch = fit(cw);
    const below = bandBottom - (box.y + box.h);
    const above = box.y - bandTop;
    if (below >= ch + GAP * 2) {
      this.host.setDock(0);
      place(cw, (vw - cw) / 2, box.y + box.h + GAP);
      return;
    }
    if (above >= ch + GAP * 2) {
      this.host.setDock(0);
      place(cw, (vw - cw) / 2, box.y - GAP - ch);
      return;
    }
    // 3. reserve a band: the map shrinks, the card sits in the freed room above the controls
    const dock = ch + GAP * 2;
    this.host.setDock(dock);
    place(cw, (vw - cw) / 2, bandBottom - ch - GAP);
  }
}
