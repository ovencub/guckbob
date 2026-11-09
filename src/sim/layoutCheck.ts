// 레이아웃 검증: 모든 좌석이 들어갈 수 있는지, 앉은 고양이(몸·꼬리)가 아무것도 뚫지 않는지, 서버가 닿는지.
import { CAT_DIM, SEAT_RULES } from '../data/layouts';
import { computeLayout, segmentClear, staticFree, type Box, type LayoutGeo, type Vec2 } from './geometry';
import { buildGrid, findPath, type Blocker } from './grid';

function boxDist3(b: Box, x: number, y: number, z: number): number {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  const dz = Math.max(b.z0 - z, 0, z - b.z1);
  return Math.hypot(dx, dy, dz);
}

/** 앉은 고양이 한 마리의 관통 깊이 최댓값 (자기 의자 제외) */
export function seatedPenetration(g: LayoutGeo, s: { x: number; z: number; ry: number }, ownStool: Box | null): number {
  let worst = 0;
  const y0 = SEAT_RULES.seatY;
  const pts: Array<[number, number, number, number]> = [];
  const fx = Math.sin(s.ry);
  const fz = Math.cos(s.ry);
  pts.push([s.x, y0 + CAT_DIM.bodyY, s.z, CAT_DIM.bodyR]);
  for (const side of [-1, 1]) {
    const lx = -fz * side * CAT_DIM.pawSide;
    const lz = fx * side * CAT_DIM.pawSide;
    pts.push([s.x + fx * CAT_DIM.pawFwd + lx, y0 + CAT_DIM.pawY, s.z + fz * CAT_DIM.pawFwd + lz, CAT_DIM.pawR]);
  }
  for (const wag of [-CAT_DIM.tailWag, 0, CAT_DIM.tailWag]) {
    const a = s.ry + wag;
    for (const [, ty, tz] of CAT_DIM.tail) {
      pts.push([s.x + Math.sin(a) * tz, y0 + ty, s.z + Math.cos(a) * tz, CAT_DIM.tailR]);
    }
  }
  for (const b of g.colliders) {
    if (b === ownStool) continue;
    for (const [x, y, z, r] of pts) worst = Math.max(worst, r - boxDist3(b, x, y, z));
  }
  return worst;
}

export interface LayoutIssue { stage: number; msg: string }

export function checkLayout(stage: number): LayoutIssue[] {
  const g = computeLayout(stage);
  const G = buildGrid(g);
  const issues: LayoutIssue[] = [];
  const bad = (msg: string) => issues.push({ stage, msg });
  const stoolBoxes = g.colliders.filter((b) => b.kind === 'stool');
  const allSeats: Array<{ t: number; i: number; x: number; z: number }> = [];
  g.tables.forEach((t) => t.seats.forEach((s, i) => allSeats.push({ t: t.id, i, x: s.x, z: s.z })));
  const seatBlockers = (exceptT: number, exceptI: number): Blocker[] =>
    allSeats.filter((s) => !(s.t === exceptT && s.i === exceptI)).map((s) => ({ x: s.x, z: s.z, r: CAT_DIM.sep }));

  if (!staticFree(g, g.spawn.x, g.spawn.z)) bad('입구(spawn) 막힘');
  if (!staticFree(g, g.exit.x, g.exit.z)) bad('출구(exit) 막힘');
  for (const t of g.tables) {
    t.seats.forEach((s, i) => {
      const own = stoolBoxes.find((b) => Math.abs((b.x0 + b.x1) / 2 - s.x) < 1e-6 && Math.abs((b.z0 + b.z1) / 2 - s.z) < 1e-6) ?? null;
      const pen = seatedPenetration(g, s, own);
      if (pen > 0.02) bad(`T${t.id} 좌석${i} 앉은 고양이 관통 ${pen.toFixed(3)}`);
      for (const o of allSeats) {
        if (o.t === t.id && o.i === i) continue;
        if (Math.hypot(o.x - s.x, o.z - s.z) < CAT_DIM.sep) bad(`T${t.id} 좌석${i} ↔ T${o.t} 좌석${o.i} 너무 가까움`);
      }
      const ap = s.approach;
      const bl = seatBlockers(t.id, i);
      if (!staticFree(g, ap.x, ap.z)) { bad(`T${t.id} 좌석${i} 진입점 막힘 (${ap.x.toFixed(2)},${ap.z.toFixed(2)})`); return; }
      if (!segmentClear(g, ap, s, g.feet[s.stool])) bad(`T${t.id} 좌석${i} 진입 직선 막힘`);
      if (bl.some((b) => Math.hypot(b.x - ap.x, b.z - ap.z) < b.r)) bad(`T${t.id} 좌석${i} 진입점이 다른 좌석과 가까움`);
      else if (!findPath(G, g.spawn, ap, bl)) bad(`T${t.id} 좌석${i} 입구에서 길 없음`);
      else if (!findPath(G, ap, g.exit, bl)) bad(`T${t.id} 좌석${i} 출구로 길 없음`);
    });
    const bl = allSeats.map((s) => ({ x: s.x, z: s.z, r: CAT_DIM.sep }));
    const okSvc = t.service.filter((p) => staticFree(g, p.x, p.z) && !bl.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < b.r));
    if (!okSvc.length) bad(`T${t.id} 서비스 지점 없음`);
    else if (!okSvc.some((p) => findPath(G, g.idle[0], p, bl))) bad(`T${t.id} 서버가 닿을 길 없음`);
  }
  for (const p of g.idle) if (!staticFree(g, p.x, p.z)) bad(`서버 대기 지점 막힘 (${p.x},${p.z})`);
  return issues;
}

/** 디버그용 ASCII 지도 */
export function asciiMap(stage: number): string {
  const g = computeLayout(stage);
  const G = buildGrid(g);
  const lines: string[] = [];
  const mark = new Map<number, string>();
  const put = (p: Vec2, ch: string) => {
    const c = Math.floor((p.x - G.x0) / G.cell);
    const r = Math.floor((p.z - G.z0) / G.cell);
    if (c >= 0 && r >= 0 && c < G.cols && r < G.rows) mark.set(r * G.cols + c, ch);
  };
  for (const t of g.tables) {
    put(t, String(t.id % 10));
    for (const s of t.seats) { put(s, 'o'); put(s.approach, 'a'); }
    for (const s of t.service) put(s, 's');
  }
  put(g.spawn, 'I'); put(g.exit, 'E');
  for (const p of g.idle) put(p, 'W');
  for (let r = 0; r < G.rows; r++) {
    let line = '';
    for (let c = 0; c < G.cols; c++) {
      const i = r * G.cols + c;
      line += mark.get(i) ?? (G.free[i] ? '.' : '#');
    }
    lines.push(line);
  }
  return lines.join('\n');
}
