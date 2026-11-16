import type { LevelDef } from '../core/types';
import { CLASSIC } from './classic';
import { HARDCORE } from './hardcore';

export { CLASSIC, HARDCORE };

/** The campaign played in the given mode. */
export const campaign = (hardcore: boolean): LevelDef[] => (hardcore ? HARDCORE : CLASSIC);
