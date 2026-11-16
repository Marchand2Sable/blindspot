import { measure } from '../src/systems/metrics';
import type { LevelDef } from '../src/core/types';
import { CLASSIC } from '../src/levels/classic';
import { HARDCORE } from '../src/levels/hardcore';
const which = process.argv[2] ?? 'classic';
const levels: LevelDef[] = which === 'hardcore' ? HARDCORE : CLASSIC;
const fast = process.argv.includes('--fast');
console.log('id    name           tgt size   open junc dead gds per  solve  wait phases moves slack score');
for (const d of levels) {
  const m = measure(d, !fast);
  console.log(
    `${d.id.padEnd(5)} ${d.name.slice(0, 14).padEnd(14)} ${String(d.target ?? '-').padStart(3)} ${m.size.padEnd(6)} ${String(m.openness).padStart(4)} ${String(m.junctions).padStart(4)} ${String(m.deadEnds).padStart(4)} ${String(m.guards).padStart(3)} ${String(m.distinctPeriods).padStart(3)} ${String(m.solveTime).padStart(6)} ${String(m.waitTime).padStart(5)} ${String(m.waitPhases).padStart(6)} ${String(m.moves).padStart(5)} ${String(m.slack).padStart(5)} ${String(m.score).padStart(5)}`,
  );
}
