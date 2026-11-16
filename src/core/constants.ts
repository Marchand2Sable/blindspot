/** Tunable gameplay constants. Units: tiles and seconds. Identical in every level. */

export const PLAYER_RADIUS = 0.28;
export const PLAYER_SPEED = 4.2;

export const GUARD_RANGE = 5;
export const GUARD_FOV = 70; // degrees
/** A guard turning at a waypoint always takes this long (also the minimum wait). */
export const TURN_TIME = 0.35;

/** Seconds of continuous exposure at maximum distance needed to be caught. */
export const DETECT_TIME = 0.75;
/** Seconds for a full meter to drain when unseen. */
export const DETECT_DECAY_TIME = 1.2;
/** Extra fill speed factor when the guard is point-blank (scales linearly with proximity). */
export const DETECT_PROXIMITY_BOOST = 1.5;
/** Classic: extra fill speed factor when the player is dead centre in the cone (0 on the edge). */
export const DETECT_CENTER_BOOST = 1.8;
/** Within this distance (with line of sight) the player is caught at once. */
export const CATCH_DISTANCE = 0.55;

export const EXIT_RADIUS = 0.5;
/** Duration of the day/night cross-fade. */
export const VISION_BLEND_TIME = 0.28;
export const DEFAULT_COOLDOWN = 3;
/** Hardcore: default number of vision switches per level (no cooldown, instant detection). */
export const HARDCORE_SWITCHES = 4;

/**
 * The three guard kinds (never more). A kind fixes vision (range, cone) and a speed band;
 * levels choose the exact speed inside the band. Same detection rules for all.
 */
export type GuardKind = 'normal' | 'heavy' | 'light';
export const GUARD_KINDS: Record<GuardKind, { label: string; range: number; fov: number; speedMin: number; speedMax: number; size: number; traits: [string, string] }> = {
  normal: { label: 'Normal', range: GUARD_RANGE, fov: GUARD_FOV, speedMin: 1.6, speedMax: 2.4, size: 1, traits: ['Vitesse moyenne', 'Vision moyenne'] },
  heavy: { label: 'Lourd', range: 7.5, fov: 50, speedMin: 1.0, speedMax: 1.5, size: 1.3, traits: ['Déplacement lent', 'Vision longue portée'] },
  light: { label: 'Léger', range: 3.4, fov: 90, speedMin: 2.5, speedMax: 3.4, size: 0.82, traits: ['Déplacement rapide', 'Vision courte portée'] },
};
