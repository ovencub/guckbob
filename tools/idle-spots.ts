// 서버 대기 자리 후보: 서버가 설 수 있고, 모든 좌석·진입점·서비스 지점·입구에서 margin 이상 떨어진 곳 (배식대 가까운 순)
import { computeLayout, staticFree } from '../src/sim/geometry';
const margin = Number(process.argv[2] ?? 1.2);
for (let st = 0; st < 4; st++) {
  const g = computeLayout(st);
  const pts = [g.spawn, g.exit];
  for (const t of g.tables) { for (const s of t.seats) pts.push(s, s.approach); for (const p of t.service) pts.push(p); }
  const out: Array<[number, number, number]> = [];
  for (let x = g.left; x < g.right; x += 0.125) for (let z = g.hallMinZ; z < g.front; z += 0.125) {
    if (!staticFree(g, x, z)) continue;
    const m = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.z - z)));
    if (m < margin) continue;
    out.push([x, z, Math.hypot(x - 1.1, z - g.pickZ)]);
  }
  out.sort((a, b) => a[2] - b[2]);
  console.log(`stage ${st + 1}:`, out.slice(0, 8).map(([x, z, d]) => `(${x.toFixed(2)},${z.toFixed(2)}) d${d.toFixed(1)}`).join(' '));
}
