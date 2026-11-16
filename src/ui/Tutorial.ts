import type { GameWorld } from '../engine/GameWorld';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the tutorial needs from the engine (keeps this module free of engine imports). */
export interface TutorialHost {
  world(): GameWorld;
  /** Tile rectangle -> screen pixels. */
  tileRect(x0: number, y0: number, x1: number, y1: number): Rect;
  /** Freeze / unfreeze the simulation (guards, timers). */
  setFrozen(on: boolean): void;
  /** Guards cannot catch the player while true (explanations); false for the final crossing. */
  setSafe(on: boolean): void;
  finish(): void;
  replay(): void;
  menu(): void;
}

interface Step {
  title: string;
  text: (touch: boolean) => string;
  /** DOM selector(s) (first visible wins) or a function giving a screen rectangle. */
  target: string[] | ((h: TutorialHost) => Rect | null) | null;
  frozen: boolean;
  safe: boolean;
  /** Action the player must perform before "Suivant" unlocks. */
  needs?: (w: GameWorld, stepTime: number) => boolean;
  needsLabel?: (touch: boolean) => string;
  /** Where the card is centred, in tiles (steps whose target moves). Default: next to the target at step start. */
  cardAt?: [number, number];
}

const pad = 10;

/**
 * Tutorial — LEVEL 0. A short, interactive walkthrough of the real mechanics, drawn as a dimmed
 * overlay with one highlighted element and a card ("Précédent" / "Suivant"). Steps that need the
 * player to act (move, switch vision, cross the level) unlock "Suivant" only once it is done.
 */
export class Tutorial {
  private root: HTMLElement;
  private hole: HTMLElement;
  private card: HTMLElement;
  private idx = 0;
  private stepTime = 0;
  private satisfied: boolean[] = [];
  private completed = false;
  private raf = 0;
  private lastKey = '';
  private touch = window.matchMedia('(pointer: coarse)').matches;

  private readonly steps: Step[] = [
    {
      title: 'Atteindre la sortie',
      text: () => 'Ton but : rejoindre la sortie, la case marquée d’un chevron, sans jamais être repéré par un garde.',
      target: (h) => {
        const e = h.world().level.exit;
        return h.tileRect(Math.floor(e.x) - 0.2, Math.floor(e.y) - 0.2, Math.floor(e.x) + 1.2, Math.floor(e.y) + 1.2);
      },
      frozen: true,
      safe: true,
    },
    {
      title: 'Le JOUR',
      text: () => 'Tu es en vision JOUR : tu vois les murs et le terrain. Les gardes sont invisibles, mais ils sont bien là.',
      target: ['#hud-vision'],
      frozen: true,
      safe: true,
    },
    {
      title: 'Passer en NUIT',
      text: (t) => `Passe en vision NUIT : ${t ? 'touche le bouton rond en bas à droite' : 'appuie sur ESPACE'}.`,
      target: ['#btn-vision', '#keys .wide', '#hud-vision'],
      frozen: false,
      safe: true,
      needs: (w) => w.vision.mode === 'night',
      needsLabel: (t) => (t ? 'Touche le bouton Jour/Nuit' : 'Appuie sur ESPACE'),
    },
    {
      title: 'Le garde et son cône',
      text: () => 'En NUIT, les murs disparaissent et le garde apparaît, avec son cône de vision. Observe sa ronde : il va et vient dans l’autre salle.',
      target: (h) => {
        const g = h.world().guards[0];
        return h.tileRect(g.x - 1.2, g.y - 1.2, g.x + 1.2, g.y + 1.2);
      },
      frozen: false,
      safe: true,
      cardAt: [3, 6.2],
      needs: (_w, t) => t >= 4,
      needsLabel: () => 'Observe sa ronde quelques secondes…',
    },
    {
      title: 'Murs invisibles',
      text: () => 'Les murs ont disparu : tu dois te souvenir de la carte. Chaque vision cache ce que l’autre montre : on ne voit jamais les deux à la fois.',
      target: (h) => {
        const l = h.world().level;
        return h.tileRect(0, 0, l.width, l.height);
      },
      frozen: true,
      safe: true,
    },
    {
      title: 'Revenir en JOUR',
      text: (t) => `Pour relire les murs, repasse en JOUR : ${t ? 'bouton rond' : 'ESPACE'}. Si la bascule n’est pas prête, attends la fin de la recharge.`,
      target: ['#btn-vision', '#keys .wide', '#hud-vision'],
      frozen: false,
      safe: true,
      needs: (w) => w.vision.mode === 'day',
      needsLabel: (t) => (t ? 'Touche le bouton Jour/Nuit' : 'Appuie sur ESPACE'),
    },
    {
      title: 'Cooldown et bascules',
      text: () => 'Après chaque bascule, la vision est bloquée quelques secondes : la barre se vide puis se recharge. En Hardcore, le nombre de bascules par niveau est en plus limité (compteur « Bascules »).',
      target: ['#hud-vision'],
      frozen: true,
      safe: true,
    },
    {
      title: 'Se déplacer',
      text: (t) => `${t ? 'Pose le pouce à gauche et glisse pour te déplacer' : 'Déplace-toi avec ZQSD, WASD ou les flèches'}. Traverse l’ouverture du mur central pour passer dans l’autre salle.`,
      target: (h) => {
        const p = h.world().player;
        return h.tileRect(p.x - 0.8, p.y - 0.8, p.x + 0.8, p.y + 0.8);
      },
      frozen: false,
      safe: true,
      cardAt: [10.5, 6.6],
      needs: (w) => w.player.x > 7.2,
      needsLabel: () => 'Passe de l’autre côté du mur',
    },
    {
      title: 'Le danger',
      text: (t) => `Le cône blanc est ce que le garde voit. Si tu y restes, la détection monte puis tu es repéré (en Hardcore : tout de suite). Repasse en NUIT pour le voir : ${t ? 'bouton rond' : 'ESPACE'}.`,
      target: (h) => {
        const g = h.world().guards[0];
        return h.tileRect(g.x - 2.2, g.y - 2.2, g.x + 2.2, g.y + 2.2);
      },
      frozen: false,
      safe: true,
      cardAt: [3, 6.2],
      needs: (w) => w.vision.mode === 'night',
      needsLabel: (t) => (t ? 'Touche le bouton Jour/Nuit' : 'Appuie sur ESPACE'),
    },
    {
      title: 'À toi de jouer',
      text: () => 'Observe la ronde, choisis ton moment, puis rejoins la sortie. Passe quand le garde s’éloigne de toi. Cette fois, il te voit pour de bon.',
      target: (h) => {
        const e = h.world().level.exit;
        return h.tileRect(Math.floor(e.x) - 0.2, Math.floor(e.y) - 0.2, Math.floor(e.x) + 1.2, Math.floor(e.y) + 1.2);
      },
      frozen: false,
      safe: false,
      cardAt: [3, 6.2],
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
      else if (a === 'prev') this.go(this.idx - 1);
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
    this.root.remove();
  }

  /** Called by the engine every frame with the elapsed time (only counts while unfrozen steps run). */
  update(dt: number): void {
    if (this.completed) return;
    if (!this.steps[this.idx].frozen) this.stepTime += dt;
    const s = this.steps[this.idx];
    if (s.needs && !this.satisfied[this.idx] && s.needs(this.host.world(), this.stepTime)) {
      this.satisfied[this.idx] = true;
      // the last step finishes the tutorial as soon as the exit is reached
      if (this.idx === this.steps.length - 1) this.complete();
      else this.render(true);
    }
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
    const ok = !s.needs || this.satisfied[this.idx];
    const key = `${this.idx}|${ok}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const last = this.idx === this.steps.length - 1;
    const dots = this.steps.map((_, i) => `<i class="${i === this.idx ? 'on' : i < this.idx ? 'past' : ''}"></i>`).join('');
    this.card.innerHTML = `
      <div class="tut-head"><span class="micro">Tutoriel · ${this.idx + 1} / ${this.steps.length}</span><span class="tut-dots" aria-hidden="true">${dots}</span></div>
      <h3>${s.title}</h3>
      <p>${s.text(this.touch)}</p>
      ${s.needs && !ok ? `<p class="tut-need">${s.needsLabel?.(this.touch) ?? 'Fais l’action pour continuer'}</p>` : ''}
      <div class="tut-actions">
        ${this.idx > 0 ? '<button class="tut-link" data-tut="prev">← Précédent</button>' : '<span></span>'}
        ${last ? '' : `<button class="tut-btn primary" data-tut="next" ${ok ? '' : 'disabled'}>Suivant</button>`}
      </div>
      <button class="tut-link tut-skip" data-tut="skip">Quitter le tutoriel</button>`;
    this.placeCard();
  }

  private resolveTarget(s: Step): Rect | null {
    if (!s.target) return null;
    if (typeof s.target === 'function') return s.target(this.host);
    for (const sel of s.target) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && getComputedStyle(el).display !== 'none') return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return null;
  }

  private loop(): void {
    if (!this.completed) this.place();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  /** Position the highlight and the card (every frame: targets such as the guard move). */
  private place(): void {
    const s = this.steps[this.idx];
    const r = this.resolveTarget(s);
    if (r) {
      this.hole.style.display = 'block';
      this.hole.style.transform = `translate(${r.x - pad}px, ${r.y - pad}px)`;
      this.hole.style.width = `${r.w + pad * 2}px`;
      this.hole.style.height = `${r.h + pad * 2}px`;
    } else {
      this.hole.style.display = 'none';
    }
  }

  /** Card position: computed once per step (and on resize), so its buttons never move under the pointer. */
  private placeCard(): void {
    if (this.completed) return this.centerCard();
    const s = this.steps[this.idx];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(360, vw - 24);
    this.card.style.width = `${cw}px`;
    const ch = this.card.offsetHeight;
    let x = (vw - cw) / 2;
    let y = (vh - ch) / 2;
    if (s.cardAt) {
      const c = this.host.tileRect(s.cardAt[0], s.cardAt[1], s.cardAt[0], s.cardAt[1]);
      x = Math.min(Math.max(12, c.x - cw / 2), vw - cw - 12);
      y = Math.min(Math.max(8, c.y - ch / 2), vh - ch - 8);
    } else {
      const r = this.resolveTarget(s);
      if (r) {
        x = Math.min(Math.max(12, r.x + r.w / 2 - cw / 2), vw - cw - 12);
        const below = r.y + r.h + pad + 16;
        const above = r.y - pad - 16 - ch;
        y = r.y + r.h / 2 < vh / 2 ? (below + ch <= vh - 8 ? below : Math.max(8, above)) : above >= 8 ? above : Math.min(vh - ch - 8, below);
      }
    }
    this.card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
