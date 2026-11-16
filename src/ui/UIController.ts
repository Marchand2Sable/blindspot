import { GUARD_KINDS, type GuardKind } from '../core/constants';
import { buildLabel } from '../buildinfo';
import type { LevelDef, VisionMode } from '../core/types';

export type ScreenName = 'title' | 'levels' | 'settings' | 'credits' | 'pause' | 'win' | 'fail' | 'end';

export interface UIActions {
  play(): void;
  openLevels(): void;
  startLevel(index: number): void;
  next(): void;
  retry(): void;
  resume(): void;
  menu(): void;
  pause(): void;
  setSound(on: boolean): void;
  setVolume(v: number): void;
  openSettings(fromPause: boolean): void;
  setReducedMotion(on: boolean): void;
  resetSave(): void;
  setHardcore(on: boolean): void;
  tutorial(): void;
  sfxClick(): void;
}

export interface HudState {
  levelIndex: number;
  name: string;
  mode: VisionMode;
  ready: boolean;
  cooldownRatio: number;
  secondsLeft: number;
  hardcore: boolean;
  switchesLeft: number;
  switchesMax: number;
  /** Guard kinds present in the level, in a stable order. */
  kinds: GuardKind[];
}

const fmt = (s: number) => `${s.toFixed(1)} s`;
const pad2 = (n: number) => String(n).padStart(2, '0');
const RING = 2 * Math.PI * 46;

const HARD_DESC = 'Un seul regard te perd. Quatre bascules par niveau, aucun cooldown.';
const NORMAL_DESC = 'Les gardes ont besoin d’un instant pour te repérer. Chaque bascule demande quelques secondes de recharge.';

/**
 * UIController — menus and HUD (DOM). Design rules: one editorial column per screen,
 * generous spacing on a 4 px scale, no boxes around information, the in-game HUD
 * follows the vision mode (body[data-vision]).
 */
export class UIController {
  private screens: HTMLElement;
  private hud: HTMLElement;
  private current: ScreenName | null = null;
  private toastTimer = 0;
  /** Current mode, mirrored from the engine so menus can show the selector. */
  hardcore = false;

  // HUD elements, built once per level so hover states survive updates
  private hudKey = '';
  private el: {
    vision: HTMLElement;
    name: HTMLElement;
    meter: HTMLElement;
    hint: HTMLElement;
    pips: HTMLElement | null;
    sw: HTMLElement | null;
    swN: HTMLElement | null;
    swNote: HTMLElement | null;
    btn: HTMLElement | null;
  } | null = null;
  private lastBtnKey = '';
  private lastSwitches = 0;

  constructor(private getLevels: () => LevelDef[], private act: UIActions) {
    this.screens = document.getElementById('screens') as HTMLElement;
    this.hud = document.getElementById('hud') as HTMLElement;
    document.body.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      this.act.sfxClick();
      this.dispatch(el.dataset.action as string, el.dataset.arg);
    });
    document.body.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.setting !== 'volume') return;
      el.style.setProperty('--p', el.value + '%');
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = el.value + '%';
      this.act.setVolume(Number(el.value) / 100);
    });
    document.body.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.setting === 'sound') this.act.setSound(el.checked);
      if (el.dataset.setting === 'volume') this.act.sfxClick();
      if (el.dataset.setting === 'motion') this.act.setReducedMotion(el.checked);
    });
  }

  private dispatch(a: string, arg?: string): void {
    switch (a) {
      case 'play': return this.act.play();
      case 'levels': return this.act.openLevels();
      case 'tutorial': return this.act.tutorial();
      case 'level': return this.act.startLevel(Number(arg));
      case 'next': return this.act.next();
      case 'retry': return this.act.retry();
      case 'resume': return this.act.resume();
      case 'menu': return this.act.menu();
      case 'pause': return this.act.pause();
      case 'hardcore': return this.act.setHardcore(arg === '1');
      case 'settings': return this.act.openSettings(arg === 'pause');
      case 'pausemenu': return this.show('pause');
      case 'credits': return this.show('credits');
      case 'title': return this.show('title');
      case 'reset':
        if (window.confirm('Effacer toute la progression ?')) this.act.resetSave();
        return;
    }
  }

  get visible(): ScreenName | null {
    return this.current;
  }

  show(name: ScreenName | null, data: Record<string, string> = {}): void {
    this.current = name;
    document.body.classList.toggle('in-menu', name !== null);
    document.body.classList.toggle('in-game', name === null || name === 'pause');
    if (name === null) {
      this.screens.innerHTML = '';
      return;
    }
    this.screens.innerHTML = `<section class="screen screen-${name}" role="dialog" aria-label="${name}"><div class="panel${name === 'levels' ? ' wide' : ''}">${this.render(name, data)}</div></section>`;
    requestAnimationFrame(() => this.screens.firstElementChild?.classList.add('shown'));
  }

  private modeSelector(): string {
    const hc = this.hardcore;
    return `<div class="modesel">
      <span class="micro">Mode de jeu</span>
      <div class="seg" role="group" aria-label="Mode de jeu">
        <button class="${hc ? '' : 'on'}" data-action="hardcore" data-arg="0" aria-pressed="${!hc}">Normal</button>
        <button class="${hc ? 'on' : ''}" data-action="hardcore" data-arg="1" aria-pressed="${hc}">Hardcore</button>
      </div>
      <p class="desc">${hc ? HARD_DESC : NORMAL_DESC}</p>
    </div>`;
  }

  private render(name: ScreenName, d: Record<string, string>): string {
    switch (name) {
      case 'title':
        return `
          <p class="micro eyebrow">Two Tone Studio présente</p>
          <h1 class="logo">Blind<span>spot</span></h1>
          <p class="tag">Le jour montre les murs. La nuit montre les gardes. Jamais les deux.</p>
          <nav class="nav" aria-label="Menu principal">
            <button class="navitem primary" data-action="play">Jouer</button>
            <button class="navitem" data-action="tutorial">Tutoriel</button>
            <button class="navitem" data-action="levels">Niveaux</button>
            <button class="navitem" data-action="settings">Paramètres</button>
            <button class="navitem" data-action="credits">Crédits</button>
          </nav>
          ${this.modeSelector()}`;
      case 'levels': {
        const rows = this.getLevels()
          .map((l, i) => {
            const locked = i >= Number(d.unlocked ?? 1);
            const best = d[`best${i}`];
            const meta = locked ? 'Verrouillé' : best ? fmt(Number(best)) : 'Non terminé';
            return `<button class="lvl${best ? ' done' : ''}" data-action="level" data-arg="${i}" ${locked ? 'disabled' : ''}>
              <span class="n micro">${pad2(i + 1)}</span><span class="t">${locked ? '—' : l.name}</span><span class="m micro">${meta}</span></button>`;
          })
          .join('');
        return `<p class="micro eyebrow">Campagne ${this.hardcore ? 'Hardcore' : 'Classic'} · ${this.getLevels().length} niveaux</p>
          <h2>Niveaux</h2>
          ${this.modeSelector()}
          <div class="levels"><button class="lvl${d.tutorial === '1' ? ' done' : ''}" data-action="tutorial"><span class="n micro">00</span><span class="t">Tutoriel</span><span class="m micro">${d.tutorial === '1' ? 'Terminé' : 'Interactif'}</span></button>${rows}</div>
          <div class="actions"><button class="link" data-action="menu">← Menu principal</button></div>`;
      }
      case 'settings':
        return `<p class="micro eyebrow">Préférences</p>
          <h2>Paramètres</h2>
          <div class="setting-list">
            <label class="setting">Son<input type="checkbox" data-setting="sound" ${d.sound === '1' ? 'checked' : ''}/></label>
            <div class="setting setting-vol"><label for="vol">Volume</label><span class="vol"><input id="vol" type="range" min="0" max="100" step="1" value="${d.volume ?? '50'}" style="--p:${d.volume ?? '50'}%" data-setting="volume" aria-label="Volume"/><output>${d.volume ?? '50'}%</output></span></div>
            <label class="setting">Réduire les animations<input type="checkbox" data-setting="motion" ${d.motion === '1' ? 'checked' : ''}/></label>
          </div>
          <p class="micro build">BLINDSPOT ${buildLabel()}</p>
          <div class="actions row">
            ${d.from === 'pause' ? '<button class="link" data-action="pausemenu">← Retour à la pause</button>' : '<button class="link" data-action="title">← Retour</button><button class="link" data-action="reset">Effacer la progression</button>'}
          </div>`;
      case 'credits':
        return `<p class="micro eyebrow">Two Tone Studio</p>
          <h2>Crédits</h2>
          <p class="lede">Blindspot est un jeu Two Tone Studio.<br/>Conception, code, niveaux et direction artistique : Two Tone Studio.<br/>Sons synthétisés en direct, aucune ressource externe.</p>
          <div class="actions"><button class="link" data-action="title">← Retour</button></div>`;
      case 'pause':
        return `<p class="micro eyebrow">En pause</p>
          <h2>Pause</h2>
          <div class="actions">
            <button class="btn" data-action="resume">Reprendre</button>
            <button class="link" data-action="retry">Recommencer<kbd>R</kbd></button>
            <button class="link" data-action="settings" data-arg="pause">Options</button>
            <button class="link" data-action="levels">Niveaux</button>
            <button class="link" data-action="menu">Menu principal</button>
          </div>`;
      case 'win':
        return `<p class="micro eyebrow">${d.chapter} terminé${this.hardcore ? ' · Hardcore' : ''}</p>
          <h2>Sortie atteinte</h2>
          <p class="stat">${d.time}</p>
          <p class="stat-note caption">${d.record === '1' ? 'Nouveau record sur ce niveau.' : d.name}</p>
          <div class="actions">
            <button class="btn" data-action="next">Niveau suivant</button>
            <button class="link" data-action="retry">Rejouer</button>
            <button class="link" data-action="levels">Niveaux</button>
            <button class="link" data-action="menu">Menu principal</button>
          </div>`;
      case 'fail': {
        const kind = (d.kind || undefined) as GuardKind | undefined;
        const who = kind ? `Repéré par un garde ${GUARD_KINDS[kind].label.toLowerCase()}.` : 'Repéré.';
        const tips: Record<string, string> = {
          normal: 'Sa vision est moyenne : observe sa ronde en NUIT, puis passe pendant qu’il tourne le dos.',
          heavy: 'Il est lent mais voit très loin : ne traverse pas sa ligne droite, profite de sa lenteur pour passer derrière lui.',
          light: 'Il est rapide mais voit court : passe entre deux de ses rondes, hors de sa portée.',
        };
        const why = kind ? tips[kind] : this.hardcore ? 'Un seul regard suffit, et tes bascules sont comptées.' : 'Observe la ronde en NUIT, mémorise les murs en JOUR.';
        const extra = d.noSwitch === '1' ? `<p class="caption">Tu n’avais plus de bascule : tu étais bloqué en ${d.mode === 'day' ? 'JOUR' : 'NUIT'}.</p>` : this.hardcore ? '<p class="caption">Un seul regard suffit en Hardcore.</p>' : '';
        return `<p class="micro eyebrow">${this.hardcore ? 'Hardcore' : 'Détection'}</p>
          <h2>${who}</h2>
          <p class="lede">${why}</p>
          ${extra}
          <div class="actions">
            <button class="btn" data-action="retry">Réessayer <kbd>R</kbd></button>
            <button class="link" data-action="levels">Niveaux</button>
            <button class="link" data-action="menu">Menu principal</button>
          </div>`;
      }
      case 'end':
        return `<p class="micro eyebrow">Two Tone Studio</p>
          <h2>Fin de la campagne</h2>
          <p class="lede">Tu as traversé tous les niveaux sans point aveugle. D’autres arrivent.</p>
          <div class="actions">
            <button class="btn" data-action="levels">Rejouer un niveau</button>
            <button class="link" data-action="menu">Menu principal</button>
          </div>`;
    }
  }

  // ------------------------------------------------------------------ HUD

  private legend(kinds: GuardKind[]): string {
    return `<ul class="gk" aria-label="Types de gardes">${kinds
      .map((k) => {
        const g = GUARD_KINDS[k];
        return `<li class='gk-${k}'><i class="gk-i" aria-hidden="true"></i><b>Garde ${g.label.toLowerCase()}</b><em>${g.traits[0].toLowerCase()} · ${g.traits[1].toLowerCase()} (${String(g.range).replace('.', ',')} cases)</em></li>`;
      })
      .join('')}</ul>`;
  }

  private buildHud(s: HudState): void {
    const pips = s.hardcore ? Array.from({ length: s.switchesMax }, () => '<i class="on"></i>').join('') : '';
    this.hud.innerHTML = `
      <div class="hud-title">
        <span class="micro">Niveau ${pad2(s.levelIndex + 1)}${s.hardcore ? ' · Hardcore' : ''}</span>
        <h2>${s.name}</h2>
        <p class="objective">Atteindre la sortie sans être détecté.</p>
        ${this.legend(s.kinds)}
      </div>
      <div class="hud-side">
        <div class="vision" id="hud-vision">
          <span class="head"><i class="mark"></i><span class="mode-name" id="hud-name"></span></span>
          <span class="meter" id="hud-meter"><i></i></span>
          <span class="micro" id="hud-hint"></span>
        </div>
        ${s.hardcore ? `<div class="sw" id="hud-sw" data-state="ok" aria-live="polite">
          <span class="sw-label">Bascules</span>
          <span class="sw-count"><b id="sw-n">${s.switchesLeft}</b><em>/${s.switchesMax}</em></span>
          <span class="sw-pips" id="hud-pips">${pips}</span>
          <span class="sw-note" id="sw-note"></span>
          <span class="sw-minus" id="sw-minus" aria-hidden="true">−1</span>
        </div>` : ''}
        <button class="pause-btn" data-action="pause" aria-label="Pause"><span class="bars"><i></i><i></i></span></button>
      </div>`;
    const q = (id: string) => this.hud.querySelector<HTMLElement>(`#${id}`);
    this.el = {
      vision: q('hud-vision') as HTMLElement,
      name: q('hud-name') as HTMLElement,
      meter: q('hud-meter') as HTMLElement,
      hint: q('hud-hint') as HTMLElement,
      pips: q('hud-pips'),
      sw: q('hud-sw'),
      swN: q('sw-n'),
      swNote: q('sw-note'),
      btn: document.getElementById('btn-vision'),
    };
    this.lastBtnKey = '';
    this.lastSwitches = s.switchesLeft;
  }

  updateHud(s: HudState): void {
    const key = `${s.levelIndex}|${s.hardcore}`;
    if (key !== this.hudKey || !this.el) {
      this.hudKey = key;
      this.buildHud(s);
    }
    const e = this.el as NonNullable<typeof this.el>;
    document.body.dataset.vision = s.mode;
    const day = s.mode === 'day';

    e.vision.classList.toggle('locked', !s.ready);
    e.name.textContent = day ? 'Jour' : 'Nuit';
    e.vision.dataset.mode = s.mode;
    if (s.hardcore) {
      e.meter.style.display = 'none';
      e.hint.textContent = '';
      const sw = e.sw as HTMLElement;
      const left = s.switchesLeft;
      const state = left <= 0 ? 'zero' : left === 1 ? 'low' : 'ok';
      sw.dataset.state = state;
      (e.swN as HTMLElement).textContent = String(Math.max(0, left));
      Array.from((e.pips as HTMLElement).children).forEach((p, i) => p.classList.toggle('off', i >= left));
      (e.swNote as HTMLElement).textContent =
        state === 'zero'
          ? `Plus de bascule : tu restes en ${day ? 'JOUR' : 'NUIT'}.`
          : state === 'low'
            ? 'Dernière bascule. Réfléchis avant de l’utiliser.'
            : 'Chaque changement de vision en consomme une.';
      if (left < this.lastSwitches) {
        sw.classList.remove('spent');
        void sw.offsetWidth;
        sw.classList.add('spent');
      }
      this.lastSwitches = left;
    } else {
      e.meter.style.display = '';
      const fill = e.meter.firstElementChild as HTMLElement;
      fill.style.transform = `scaleX(${s.ready ? 1 : 1 - s.cooldownRatio})`;
      const touch = window.matchMedia('(pointer: coarse)').matches;
      e.hint.textContent = s.ready ? (touch ? 'Prêt' : 'Espace') : `${s.secondsLeft.toFixed(1)} s`;
    }

    const btn = e.btn;
    if (btn) {
      const bk = `${s.mode}|${s.hardcore}|${s.hardcore ? s.switchesLeft : s.cooldownRatio.toFixed(2)}|${s.ready}`;
      if (bk !== this.lastBtnKey) {
        this.lastBtnKey = bk;
        btn.className = s.ready ? 'ready' : 'locked';
        const off = RING * (s.hardcore ? 0 : s.cooldownRatio);
        btn.innerHTML = `<svg viewBox="0 0 100 100" class="ring" aria-hidden="true"><circle cx="50" cy="50" r="46" class="track"/><circle cx="50" cy="50" r="46" class="fill" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>${s.hardcore ? `<b class="count">${s.switchesLeft}</b>` : ''}<span>${day ? 'Jour' : 'Nuit'}</span>`;
      }
    }
  }

  denied(): void {
    for (const el of [this.el?.vision, document.getElementById('btn-vision')]) {
      if (!el) continue;
      el.classList.remove('shake');
      void (el as HTMLElement).offsetWidth;
      el.classList.add('shake');
    }
  }

  showHud(on: boolean): void {
    document.body.classList.toggle('hud-on', on);
    if (!on) {
      this.hudKey = '';
      this.el = null;
    }
  }

  toast(text: string, ms = 5200): void {
    const t = document.getElementById('toast') as HTMLElement;
    t.textContent = text;
    // sit just above the key legend, whatever height it wraps to (it is hidden on touch screens)
    const keys = document.getElementById('keys');
    const kh = keys && getComputedStyle(keys).display !== 'none' ? keys.offsetHeight : 0;
    t.style.setProperty('--keys-h', `${kh}px`);
    t.classList.add('on');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms);
  }

  hideToast(): void {
    window.clearTimeout(this.toastTimer);
    document.getElementById('toast')?.classList.remove('on');
  }
}
