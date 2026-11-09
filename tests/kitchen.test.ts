import { describe, expect, it } from 'vitest';
import { REVIEW } from '../src/data/balance';
import * as cmd from '../src/sim/commands';
import { reviewCap, reviewExpected, pushReview, sampleReview, speedFactor } from '../src/sim/review';
import { hire } from '../src/sim/catalog';
import { chefTaste, newGame, playerTaste, priceOf, rating } from '../src/sim/state';
import { openDay, putOnPass, run, seatNow } from './helpers';

describe('조리 (GDD 4.3)', () => {
  it('메뉴가 하나뿐이면 화구 탭 즉시 조리, 그릇 1개 소모', () => {
    const { s, ev } = openDay();
    expect(cmd.tapBurner(s, 0, ev)).toBe(true);
    expect(s.dayState!.burners[0].phase).toBe('cooking');
    expect(s.dayState!.clean).toBe(5);
  });

  it('메뉴가 여럿이면 선택이 필요하다', () => {
    const { s, ev } = openDay(1, (g) => { g.menus.spicy = true; });
    expect(cmd.tapBurner(s, 0, ev)).toBe('menu');
    expect(cmd.startCook(s, 0, 'spicy', ev)).toBe(true);
    expect(s.dayState!.burners[0].dur).toBeCloseTo(3.5);
  });

  it('그릇이 0이면 조리할 수 없다', () => {
    const { s, ev } = openDay();
    s.dayState!.clean = 0;
    expect(cmd.tapBurner(s, 0, ev)).toBe(false);
    expect(ev.some((e) => e.k === 'toast' && e.msg === '그릇이 없어요')).toBe(true);
  });

  it('순대국밥 3초 후 완료, 3초 안에 안 옮기면 탄다', () => {
    const { s, ev } = openDay();
    cmd.tapBurner(s, 0, ev);
    run(s, 2.9, ev);
    expect(s.dayState!.burners[0].phase).toBe('cooking');
    run(s, 0.2, ev);
    expect(s.dayState!.burners[0].phase).toBe('done');
    run(s, 3.0, ev);
    expect(ev.some((e) => e.k === 'burn')).toBe(true);
    expect(s.dayState!.burnt).toBe(1);
    expect(s.dayState!.sink).toBe(1); // 그릇은 개수대로
  });

  it('개수대가 꽉 차 있으면 탄 냄비가 화구를 막는다', () => {
    const { s, ev } = openDay();
    cmd.tapBurner(s, 0, ev);
    s.dayState!.sink = 8;
    run(s, 6.2, ev);
    expect(s.dayState!.burners[0].phase).toBe('burnt');
    cmd.wash(s, ev);
    run(s, 0.1, ev);
    expect(s.dayState!.burners[0].phase).toBe('empty');
  });

  it('완료 국밥 탭 → 배식대. 배식대가 꽉 차면 못 옮긴다', () => {
    const { s, ev } = openDay();
    const ds = s.dayState!;
    expect(ds.pass.length).toBe(4);
    cmd.tapBurner(s, 0, ev);
    run(s, 3.1);
    for (let i = 0; i < 4; i++) putOnPass(s, 'sundae');
    expect(cmd.collect(s, 0, ev)).toBe(false);
    expect(ev.some((e) => e.k === 'toast' && e.msg === '배식대가 꽉 찼어요')).toBe(true);
    ds.pass[2] = null;
    expect(cmd.collect(s, 0, ev)).toBe(true);
    expect(s.dayState!.pass[2]?.menu).toBe('sundae');
  });

  it('주방장 조리는 절대 타지 않는다 (배식대가 꽉 차도 화구 위에서 대기)', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'chef', 0));
    seatNow(s, 4, 1, ['sundae', 'sundae', 'sundae', 'sundae']);
    for (let i = 0; i < 4; i++) putOnPass(s, 'sundae');
    seatNow(s, 4, 2, ['sundae', 'sundae', 'sundae', 'sundae']);
    run(s, 12, ev);
    expect(ev.some((e) => e.k === 'burn')).toBe(false);
    expect(s.dayState!.burners.some((b) => b.phase === 'done')).toBe(true);
  });
});

describe('서빙·청소·설거지 (GDD 4.4~4.8)', () => {
  it('배식대 탭 → 그 메뉴를 가장 오래 기다린 테이블로', () => {
    const { s, ev } = openDay();
    const a = seatNow(s, 1, 0, ['sundae']);
    run(s, 2);
    const b = seatNow(s, 1, 1, ['sundae']);
    const slot = putOnPass(s, 'sundae');
    expect(cmd.serve(s, slot, ev)).toBe(true);
    expect(a.orders[0].served).toBe(true);
    expect(b.orders[0].served).toBe(false);
  });

  it('기다리는 테이블이 없으면 그대로 남는다', () => {
    const { s, ev } = openDay();
    const slot = putOnPass(s, 'sundae');
    expect(cmd.serve(s, slot, ev)).toBe(false);
    expect(s.dayState!.pass[slot]).not.toBeNull();
  });

  it('드래그 서빙: 메뉴가 안 맞으면 실패', () => {
    const { s, ev } = openDay(1, (g) => { g.menus.spicy = true; });
    seatNow(s, 1, 0, ['spicy']);
    const slot = putOnPass(s, 'sundae');
    expect(cmd.serve(s, slot, ev, 0)).toBe(false);
  });

  it('주문을 받기 전에는 서빙되지 않는다', () => {
    const { s, ev } = openDay();
    seatNow(s, 1, 0, ['sundae'], false);
    expect(cmd.serve(s, putOnPass(s, 'sundae'), ev)).toBe(false);
  });

  it('식사 5초 → 퇴장, 동전 + 리뷰', () => {
    const { s, ev } = openDay();
    const t = seatNow(s, 2, 1, ['sundae', 'sundae']);
    cmd.serve(s, putOnPass(s, 'sundae'), ev);
    cmd.serve(s, putOnPass(s, 'sundae'), ev);
    run(s, 4.9, ev);
    expect(t.state).toBe('seated');
    run(s, 0.2, ev);
    expect(t.state).toBe('leaving');
    expect(s.dayState!.tables[1].coins).toBe(18000);
    expect(ev.filter((e) => e.k === 'review').length).toBe(1);
  });

  it('개수대 빈 칸이 모자라면 치울 수 없다', () => {
    const { s, ev } = openDay();
    const ds = s.dayState!;
    ds.tables[1].dirty = true; ds.tables[1].coins = 18000; ds.tables[1].bowls = 2;
    ds.sink = 7;
    expect(cmd.clean(s, 1, ev)).toBe(false);
    ds.sink = 6;
    expect(cmd.clean(s, 1, ev)).toBe(true);
    expect(s.money).toBe(18000);
    expect(ds.sink).toBe(8);
  });

  it('개수대 탭 1번 = 그릇 1개, 쿨다운 0.15초', () => {
    const { s, ev } = openDay();
    const ds = s.dayState!;
    ds.sink = 3; ds.clean = 0;
    expect(cmd.wash(s, ev)).toBe(true);
    expect(cmd.wash(s, ev)).toBe(false);
    run(s, 0.16);
    expect(cmd.wash(s, ev)).toBe(true);
    expect(ds.clean).toBe(2);
    expect(ds.sink).toBe(1);
  });
});

describe('맛·친절·리뷰 (GDD 5장)', () => {
  it('맛 레벨: 주방장 없음 = 1 + floor(연구/2)', () => {
    const s = newGame(1);
    expect(playerTaste(s)).toBe(1);
    s.taste = 3;
    expect(playerTaste(s)).toBe(2);
  });
  it('맛 레벨: 주방장 = 실력 + 연구 (최대 10)', () => {
    const s = newGame(1);
    hire(s, 'chef', 3);
    s.taste = 4;
    expect(chefTaste(s, s.staff[0])).toBe(10);
    s.taste = 2;
    expect(chefTaste(s, s.staff[0])).toBe(8);
  });
  it('맛 레벨: 주방장이 있을 때 플레이어 = 최고 주방장 − 1', () => {
    const s = newGame(1);
    hire(s, 'chef', 0); hire(s, 'chef', 2);
    expect(playerTaste(s)).toBe(4);
  });
  it('판매가 = 가격 × (1 + 0.04 × (맛 − 1))', () => {
    expect(priceOf('sundae', 1)).toBe(9000);
    expect(priceOf('sundae', 10)).toBe(Math.round(9000 * 1.36));
  });
  it('속도 계수: p ≤ 0.4 → 1, p = 1 → 0.4', () => {
    expect(speedFactor(0.3)).toBe(1);
    expect(speedFactor(1)).toBeCloseTo(0.4);
    expect(speedFactor(0.7)).toBeCloseTo(0.7);
  });
  it('시작 상태 상한 C = 0.86', () => {
    expect(reviewCap(1, 2)).toBeCloseTo(0.86);
  });
  it('시작 상태 리뷰는 대부분 0.6~1.2, 1만 샘플 평균 = Q ± 0.05', () => {
    const h = { rng: 7 };
    let sum = 0;
    let inside = 0;
    for (let i = 0; i < 10000; i++) {
      const v = sampleReview(h, 1, 2, 0.2);
      sum += v;
      if (v >= 0.55 && v <= 1.2) inside++;
    }
    expect(Math.abs(sum / 10000 - reviewExpected(1, 2, 0.2))).toBeLessThan(0.05);
    expect(inside / 10000).toBeGreaterThan(0.75);
  });
  it('높은 맛·친절이면 높은 평균', () => {
    const h = { rng: 9 };
    let sum = 0;
    for (let i = 0; i < 4000; i++) sum += sampleReview(h, 10, 10, 0.1);
    expect(sum / 4000).toBeGreaterThan(4.7);
  });
  it('가게 별점 = 최근 50건 평균, 귀빈은 10건', () => {
    const s = newGame(1);
    expect(rating(s)).toBe(0);
    for (let i = 0; i < 60; i++) pushReview(s.reviews, i < 10 ? 0 : 4);
    expect(s.reviews.length).toBe(REVIEW.window);
    expect(rating(s)).toBe(4);
    pushReview(s.reviews, 0, REVIEW.vipWeight);
    expect(rating(s)).toBeCloseTo(4 * 40 / 50);
  });
});
