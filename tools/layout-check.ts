import { asciiMap, checkLayout } from '../src/sim/layoutCheck';
import { STAGES } from '../src/data/layouts';
const only = process.argv[2] !== undefined ? [Number(process.argv[2])] : STAGES.map((_, i) => i);
for (const s of only) {
  if (process.argv.includes('--map')) console.log(`--- stage ${s + 1}\n` + asciiMap(s));
  const iss = checkLayout(s);
  console.log(`stage ${s + 1}: ${iss.length ? iss.map((i) => i.msg).join('\n  ') : 'OK'}`);
}
