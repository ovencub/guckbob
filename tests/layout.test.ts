import { describe, expect, it } from 'vitest';
import { CAT_DIM, SEAT_RULES, STAGES } from '../src/data/layouts';
import { checkLayout } from '../src/sim/layoutCheck';
import { inHall } from '../src/sim/movement';
import { geoOf } from '../src/sim/state';
import * as cmd from '../src/sim/commands';
import { openDay, run } from './helpers';

describe('레이아웃 (ART.md 8.2)', () => {
  for (let st = 0; st < STAGES.length; st++) {
    it(`${st + 1}단계: 모든 좌석에 길이 있고 앉은 고양이가 아무것도 뚫지 않는다`, () => {
      expect(checkLayout(st)).toEqual([]);
    });
  }
  it('의자 중심 = 테이블 가장자리에서 0.5칸, 나란히 좌석 간격 ≥ 0.9', () => {
    const g = geoOf(3);
    for (const t of g.tables) {
      for (const s of t.seats) {
        expect(Math.abs(Math.abs(s.z - t.z) - (t.d / 2 + SEAT_RULES.seatGap))).toBeLessThan(1e-9);
        for (const o of t.seats) if (o !== s && o.z === s.z) expect(Math.abs(o.x - s.x)).toBeGreaterThanOrEqual(0.9 - 1e-9);
      }
    }
  });
});

describe('이동 중 고양이끼리 겹치지 않는다', () => {
  it('바쁜 하루 (4단계 가게, 손님 많음)', () => {
    const { s, ev } = openDay(11, (g) => { g.stage = 3; g.burners = 6; g.menus.spicy = true; g.kiosk = true; });
    s.promos.push({ id: 'tv', days: 3 }, { id: 'youtube', days: 3 });
    s.dayState!.nextArrival = 0.5;
    let minD = Infinity;
    for (let i = 0; i < 30 * 120; i++) {
      run(s, 1 / 30, ev);
      const ds = s.dayState;
      if (!ds) break;
      if (i % 4 === 0) {
        ds.tables.forEach((tb) => cmd.tapTable(s, tb.id, ev));
        ds.burners.forEach((b, k) => { if (b.phase === 'empty') cmd.startCook(s, k, 'sundae', ev); else if (b.phase === 'done') cmd.collect(s, k, ev); });
        ds.pass.forEach((p, k) => p && cmd.serve(s, k, ev));
        cmd.wash(s, ev);
      }
      const hall = ds.cats.filter(inHall);
      for (let a = 0; a < hall.length; a++) {
        for (let b = a + 1; b < hall.length; b++) {
          const d = Math.hypot(hall[a].x - hall[b].x, hall[a].z - hall[b].z);
          if (d < minD) minD = d;
        }
      }
    }
    expect(minD).toBeGreaterThan(CAT_DIM.sep - 0.02);
  });
});
