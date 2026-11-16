import { CLASSIC } from '../src/levels/classic';
import { cooldownPressure } from '../src/systems/metrics';
console.log('id   name            cd   dangerRun turns ratio');
for (const d of CLASSIC) {
  const p = cooldownPressure(d);
  console.log(`${d.id.padEnd(4)} ${d.name.slice(0, 14).padEnd(14)} ${String(d.cooldown).padStart(4)} ${p.dangerRun.toFixed(2).padStart(9)} ${String(p.turns).padStart(5)} ${p.ratio.toFixed(2).padStart(5)}`);
}
