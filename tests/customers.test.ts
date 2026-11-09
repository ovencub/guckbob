import { describe, expect, it } from 'vitest';
import { ARRIVAL, TABLE, TUTORIAL } from '../src/data/balance';
import { arrive, findTable, makeTeam, patienceLevel, patienceUsed, teamPatience } from '../src/sim/customers';
import { arrivalRate, geoOf, maxTableCap, queuePatience } from '../src/sim/state';
import * as cmd from '../src/sim/commands';
import { openDay, run, seatNow } from './helpers';
import { pushReview } from '../src/sim/review';

describe('손님 입장 (GDD 4.1)', () => {
  it('가장 큰 테이블보다 큰 팀은 뽑지 않는다', () => {
    const { s } = openDay(3);
    expect(maxTableCap(s)).toBe(4);
    s.dayState!.nextArrival = 0;
    for (let i = 0; i < 400; i++) {
      s.dayState!.nextArrival = s.dayState!.t;
      run(s, 1 / 30);
    }
    expect(Math.max(...s.dayState!.teams.map((t) => t.size))).toBeLessThanOrEqual(4);
  });

  it('인원이 들어가는 가장 작은 빈 테이블로', () => {
    const { s } = openDay();
    const g = geoOf(0);
    const two = g.tables.findIndex((t) => t.cap === 2);
    expect(findTable(s, 1)).toBe(two);
    expect(findTable(s, 2)).toBe(two);
    expect(g.tables[findTable(s, 3)].cap).toBe(4);
  });

  it('치워지지 않은 테이블은 빈 테이블이 아니다', () => {
    const { s } = openDay();
    const two = geoOf(0).tables.findIndex((t) => t.cap === 2);
    s.dayState!.tables[two].dirty = true;
    expect(geoOf(0).tables[findTable(s, 1)].cap).toBe(4);
  });

  it('웨이팅 줄은 최대 6팀, 넘치면 놓친 손님', () => {
    const { s, ev } = openDay();
    s.dayState!.tables.forEach((t) => { t.dirty = true; });
    for (let i = 0; i < 8; i++) arrive(s, makeTeam(s, 2), (e) => ev.push(e));
    expect(s.dayState!.queue.length).toBe(ARRIVAL.maxQueue);
    expect(s.dayState!.missed).toBe(4);
  });

  it('웨이팅 인내심 = 10 + 5 × 별점', () => {
    const { s } = openDay();
    expect(queuePatience(s)).toBe(10);
    for (let i = 0; i < 50; i++) pushReview(s.reviews, 5);
    expect(queuePatience(s)).toBe(35);
  });

  it('웨이팅 인내심이 다 되면 떠난다', () => {
    const { s, ev } = openDay();
    s.dayState!.tables.forEach((t) => { t.dirty = true; });
    arrive(s, makeTeam(s, 2), (e) => ev.push(e));
    run(s, 9.5);
    expect(s.dayState!.queue.length).toBe(1);
    run(s, 1);
    expect(s.dayState!.queue.length).toBe(0);
    expect(s.dayState!.missed).toBe(2);
  });

  it('자리가 나면 줄에서 그 자리에 들어가는 첫 팀이 입장 (작은 팀 새치기)', () => {
    const { s, ev } = openDay();
    const ds = s.dayState!;
    ds.tables.forEach((t) => { t.dirty = true; });
    const big = makeTeam(s, 4); arrive(s, big, (e) => ev.push(e));
    const small = makeTeam(s, 2); arrive(s, small, (e) => ev.push(e));
    const two = geoOf(0).tables.findIndex((t) => t.cap === 2);
    ds.tables[two].dirty = false;
    run(s, 0.1);
    expect(small.state).toBe('entering');
    expect(big.state).toBe('queue');
  });

  it('도착률 λ = (7 + 3 × 별점) × (1 + 홍보) × 티어 배수', () => {
    const { s } = openDay();
    expect(arrivalRate(s)).toBeCloseTo(7);
    s.promos.push({ id: 'blog', days: 2 });
    expect(arrivalRate(s)).toBeCloseTo(7 * 1.35);
    s.tier = 1;
    expect(arrivalRate(s)).toBeCloseTo(7 * 1.35 * 1.1);
  });

  it('홍보 보너스 합은 최대 +200%', () => {
    const { s } = openDay();
    s.promos.push({ id: 'tv', days: 2 }, { id: 'youtube', days: 2 }, { id: 'google', days: 2 });
    expect(arrivalRate(s)).toBeCloseTo(7 * 3);
  });

  it('손님은 걸어 들어가 앉는다 (5칸/초)', () => {
    const { s, ev } = openDay();
    const t = makeTeam(s, 2);
    arrive(s, t, (e) => ev.push(e));
    run(s, 4, ev);
    expect(t.state).toBe('seated');
    expect(ev.some((e) => e.k === 'seated')).toBe(true);
  });
});

describe('주문·인내심 (GDD 4.2, 4.5)', () => {
  it('테이블 인내심 = 22 + 3 × (주문 수 − 1)', () => {
    const { s } = openDay();
    expect(teamPatience(makeTeam(s, 1))).toBe(22);
    expect(teamPatience(makeTeam(s, 4))).toBe(31);
  });

  it('튜토리얼 팀은 인내심 2배', () => {
    const { s } = openDay();
    expect(teamPatience(makeTeam(s, 1, { scripted: true }))).toBe(22 * TUTORIAL.patienceMult);
  });

  it('50% 노랑 → 80% 빨강 → 100% 화나서 퇴장 (리뷰 0.0)', () => {
    const { s, ev } = openDay();
    const t = seatNow(s, 1, 0, ['sundae']);
    run(s, 22 * 0.45);
    expect(patienceLevel(patienceUsed(s, t))).toBe('ok');
    run(s, 22 * 0.1);
    expect(patienceLevel(patienceUsed(s, t))).toBe('warn');
    run(s, 22 * 0.3);
    expect(patienceLevel(patienceUsed(s, t))).toBe('danger');
    run(s, 22 * 0.2, ev);
    expect(t.angry).toBe(true);
    expect(ev.some((e) => e.k === 'review' && e.score === 0)).toBe(true);
    expect(s.dayState!.angry).toBe(1);
  });

  it('화나서 나간 테이블: 놓인 그릇이 남아 지저분, 치우면 0원', () => {
    const { s, ev } = openDay();
    const t = seatNow(s, 2, 1, ['sundae', 'sundae']);
    const ds = s.dayState!;
    ds.pass[0] = { id: 99, menu: 'sundae', taste: 1, by: -1, res: 0, at: 0 };
    cmd.serve(s, 0, ev);
    run(s, 26);
    expect(t.angry).toBe(true);
    expect(ds.tables[1].dirty).toBe(true);
    const before = s.money;
    expect(cmd.clean(s, 1, ev)).toBe(true);
    expect(s.money).toBe(before);
    expect(ds.sink).toBe(1);
  });

  it('테이블 탭 → 주문 접수', () => {
    const { s, ev } = openDay();
    const t = seatNow(s, 1, 0, ['sundae'], false);
    expect(cmd.tapTable(s, 0, ev)).toBe(true);
    expect(t.orderTaken).toBe(true);
  });

  it('키오스크가 있으면 착석 0.6초 후 자동 접수', () => {
    const { s, ev } = openDay(1, (g) => { g.kiosk = true; });
    const t = makeTeam(s, 1);
    arrive(s, t, (e) => ev.push(e));
    run(s, 4);
    expect(t.state).toBe('seated');
    const at = t.seatedT;
    expect(t.orderTaken).toBe(s.dayState!.t - at >= TABLE.kioskDelaySec);
    run(s, 0.7);
    expect(t.orderTaken).toBe(true);
  });

  it('수육은 2인 이상 팀만, 팀당 최대 1개', () => {
    const { s } = openDay(5, (g) => { g.menus.suyuk = true; g.menus.spicy = true; });
    for (let i = 0; i < 300; i++) {
      const one = makeTeam(s, 1);
      expect(one.orders.some((o) => o.menu === 'suyuk')).toBe(false);
      const four = makeTeam(s, 4);
      expect(four.orders.filter((o) => o.menu === 'suyuk').length).toBeLessThanOrEqual(1);
    }
  });
});
