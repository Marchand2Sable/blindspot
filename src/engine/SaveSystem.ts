export interface SaveData {
  /** Number of unlocked levels (>= 1). */
  unlocked: number;
  /** Unlocked levels in the HARDCORE campaign. */
  unlockedHard: number;
  /** Best completion time (seconds) per level index. */
  best: Record<string, number>;
  settings: { sound: boolean; volume: number; reducedMotion: boolean; hardcore: boolean };
  /** The interactive tutorial (level 0) was completed. */
  tutorialDone: boolean;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'blindspot.save.v1';

function defaults(): SaveData {
  return { unlocked: 1, unlockedHard: 1, best: {}, settings: { sound: true, volume: 0.5, reducedMotion: false, hardcore: false }, tutorialDone: false };
}

/** SaveSystem — progression and settings in localStorage. Never throws (private mode, bad JSON). */
export class SaveSystem {
  data: SaveData = defaults();

  constructor(private store: StorageLike | null = SaveSystem.defaultStore()) {
    this.load();
  }

  private static defaultStore(): StorageLike | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  private load(): void {
    try {
      const raw = this.store?.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<SaveData>;
      const d = defaults();
      if (typeof p.unlocked === 'number' && p.unlocked >= 1) d.unlocked = Math.floor(p.unlocked);
      if (typeof p.unlockedHard === 'number' && p.unlockedHard >= 1) d.unlockedHard = Math.floor(p.unlockedHard);
      if (p.best && typeof p.best === 'object') {
        for (const [k, v] of Object.entries(p.best)) if (typeof v === 'number') d.best[k] = v;
      }
      d.tutorialDone = p.tutorialDone === true;
      if (p.settings) {
        d.settings.sound = p.settings.sound !== false;
        if (typeof p.settings.volume === 'number' && isFinite(p.settings.volume)) d.settings.volume = Math.min(1, Math.max(0, p.settings.volume));
        d.settings.reducedMotion = p.settings.reducedMotion === true;
        d.settings.hardcore = p.settings.hardcore === true;
      }
      this.data = d;
    } catch {
      this.data = defaults();
    }
  }

  save(): void {
    try {
      this.store?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable: progression is session-only */
    }
  }

  /** Best times are stored per mode: key "3" = normal, "h3" = hardcore. */
  static bestKey(index: number, hardcore: boolean): string {
    return hardcore ? `h${index}` : String(index);
  }

  completeLevel(index: number, time: number, levelCount: number, hardcore = false): void {
    const key = SaveSystem.bestKey(index, hardcore);
    const prev = this.data.best[key];
    if (prev === undefined || time < prev) this.data.best[key] = time;
    if (hardcore) this.data.unlockedHard = Math.min(levelCount, Math.max(this.data.unlockedHard, index + 2));
    else this.data.unlocked = Math.min(levelCount, Math.max(this.data.unlocked, index + 2));
    this.save();
  }

  unlockedFor(hardcore: boolean): number {
    return hardcore ? this.data.unlockedHard : this.data.unlocked;
  }

  reset(): void {
    this.data = defaults();
    this.save();
  }
}
