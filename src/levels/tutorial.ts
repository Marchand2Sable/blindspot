import type { LevelDef } from '../core/types';

/**
 * LEVEL 0 — interactive tutorial (see ui/Tutorial.ts). Not part of any campaign: it is played
 * with CLASSIC rules, one normal guard on a vertical patrol, a two-cell gap in the middle wall.
 */
export const TUTORIAL: LevelDef = {
  id: 'T00',
  name: 'Tutoriel',
  intent: 'Apprendre les deux visions, la bascule, son cooldown et la lecture d’une ronde.',
  target: 1,
  hint: 'Suis les indications.',
  cooldown: 3,
  map: [
    '###############',
    '#S....#.......#',
    '#.....#.......#',
    '#.....#.......#',
    '#.............#',
    '#.....#.....E.#',
    '#.....#.......#',
    '#.....#.......#',
    '###############',
  ],
  guards: [
    {
      speed: 1.8,
      path: [
        { x: 10.5, y: 1.5, wait: 0.8 },
        { x: 10.5, y: 7.5, wait: 0.8 },
      ],
      offset: 1.5,
    },
  ],
};
