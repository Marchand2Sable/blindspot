// usage: npx vite-node scripts/audit.ts [classic|hardcore]
import { CLASSIC } from '../src/levels/classic';
import { HARDCORE } from '../src/levels/hardcore';
import { dangerCells, freeRoute, hasAlternativeRoute, startCheck } from '../src/systems/audit';
import { validateLevel } from '../src/systems/validator';

const which = process.argv[2] ?? 'classic';
const levels = which === 'hardcore' ? HARDCORE : CLASSIC;
console.log('id    free  alt  firstSeen minDist  wait  guards');
for (const def of levels) {
  const ref = validateLevel(def);
  const free = freeRoute(def);
  const alt = hasAlternativeRoute(def, ref);
  const s = startCheck(def);
  console.log(
    `${def.id.padEnd(5)} ${(free ? free + 'c' : '-').padEnd(5)} ${(alt ? 'yes' : 'no').padEnd(4)} ${s.firstSeen === Infinity ? '  never' : s.firstSeen.toFixed(2).padStart(6)}    ${s.minDist.toFixed(1).padStart(5)}  ${ref.waitTime.toFixed(1).padStart(5)}  ${def.guards.length}`,
  );
}
