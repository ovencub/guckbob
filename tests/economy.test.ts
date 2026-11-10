import { describe, expect, it } from 'vitest';
import { buy, offers, regradeCost } from '../src/sim/catalog';
import { CHEF, hireFee } from '../src/data/staff';
import { PROMO_BY_ID } from '../src/data/promos';
import { TIERS } from '../src/data/tiers';
import { avgRevenue3, tierReady } from '../src/sim/economy';
import { pushReview } from '../src/sim/review';
import { finishSettle, startDay, step } from '../src/sim/sim';
import { newGame } from '../src/sim/state';
import type { SimEvent } from '../src/sim/types';
import { openDay, run } from './helpers';

describe('하루 흐름·정산 (GDD 3장, 12장)', () => {
  it('영업 120초 → 마감 → 정산 → 정비', () => {
    const { s } = openDay();
    run(s, 119.9);
    expect(s.phase).toBe('open');
    run(s, 0.2);
    expect(['overtime', 'settle']).toContain(s.phase);
    run(s, 16);
    expect(s.phase).toBe('settle');
    expect(s.lastReport!.rent).toBe(20000);
    expect(s.lastReport!.utility).toBe(6000);
    finishSettle(s);
    expect(s.phase).toBe('prep');
    expect(s.day).toBe(2);
  });

  it('돈이 마이너스여도 게임오버 없음, 구매만 막힌다', () => {
    const { s } = openDay();
    run(s, 140);
    finishSettle(s);
    expect(s.money).toBeLessThan(0);
    expect(s.phase).toBe('prep');
    expect(offers(s).find((o) => o.id === 'bowls')!.ok).toBe(false);
  });

  it('홍보는 다음 영업부터 적용, 홍보비는 그날 영수증에', () => {
    const s = newGame(2);
    const cost = PROMO_BY_ID.blog.cost;
    s.money = 100000;
    s.tutorial = false;
    expect(buy(s, 'promo:blog')).toBe(true);
    expect(s.money).toBe(100000 - cost);
    startDay(s);
    expect(s.promos.find((p) => p.id === 'blog')?.days).toBe(2);
    const ev: SimEvent[] = [];
    while (s.phase !== 'settle') step(s, ev);
    expect(s.lastReport!.promo).toBe(cost);
    expect(s.promos.find((p) => p.id === 'blog')?.days).toBe(1);
  });

  it('티어: 별점과 3일 평균 매출 둘 다', () => {
    const s = newGame(1);
    const T = TIERS[1];
    for (let i = 0; i < 50; i++) pushReview(s.reviews, T.rating + 0.1);
    s.revenues = [T.revenue3 - 10000, T.revenue3 + 10000];
    expect(avgRevenue3(s)).toBe(T.revenue3);
    expect(tierReady(s, 1)).toBe(true);
    s.revenues = [T.revenue3 - 100000, T.revenue3 + 10000, T.revenue3 + 10000, T.revenue3 + 10000];
    expect(avgRevenue3(s)).toBe(T.revenue3 + 10000); // 최근 3일만
    s.revenues = [T.revenue3 - 30000, T.revenue3 - 30000, T.revenue3 - 30000];
    expect(tierReady(s, 1)).toBe(false); // 매출 모자람
    s.revenues = [T.revenue3, T.revenue3, T.revenue3];
    for (let i = 0; i < 50; i++) pushReview(s.reviews, T.rating - 0.1);
    expect(tierReady(s, 1)).toBe(false); // 별점 모자람
  });

  it('미슐랭은 귀빈 인정이 있어야', () => {
    const s = newGame(1);
    for (let i = 0; i < 50; i++) pushReview(s.reviews, 4.8);
    s.revenues = [3000000, 3000000, 3000000];
    s.tier = 4;
    expect(tierReady(s, 5)).toBe(false);
    s.vipOk = true;
    expect(tierReady(s, 5)).toBe(true);
  });

  it('조건 미충족 항목은 잠금 이유를 보여준다', () => {
    const s = newGame(1);
    s.money = 1e7;
    const o = offers(s);
    expect(o.find((x) => x.id === 'menu:suyuk')!.reason).toBe('동네 맛집 이상');
    expect(o.find((x) => x.id === 'hire:chef:2')!.reason).toBe('동네 맛집 이상');
    expect(o.find((x) => x.id === 'taste')!.reason).toBe('주방장 1명 이상');
    expect(o.find((x) => x.id === 'burner')!.ok).toBe(true);
    buy(s, 'burner');
    expect(offers(s).find((x) => x.id === 'burner')!.reason).toBe('가게를 넓혀야 자리가 나요');
  });

  it('직원 최대 인원: 주방장 3, 서버 2, 설거지 1', () => {
    const s = newGame(1);
    s.money = 10_000_000;
    for (let i = 0; i < 5; i++) buy(s, 'hire:server:0');
    expect(s.staff.filter((m) => m.role === 'server').length).toBe(2);
    for (let i = 0; i < 5; i++) buy(s, 'hire:dish:0');
    expect(s.staff.filter((m) => m.role === 'dish').length).toBe(1);
  });

  it('직원 고용은 계약금(일당 × 2.5)이 들고, 승급은 계약금 차액', () => {
    const s = newGame(1);
    expect(buy(s, 'hire:chef:0')).toBe(false); // 돈 0
    s.money = 1_000_000;
    expect(buy(s, 'hire:chef:0')).toBe(true);
    expect(s.money).toBe(1_000_000 - hireFee(CHEF.wage[0]));
    const id = s.staff[0].id;
    expect(regradeCost(s, id, 1)).toBe(hireFee(CHEF.wage[1]) - hireFee(CHEF.wage[0]));
    expect(regradeCost(s, id, 0)).toBe(0);
  });

  it('같은 시드면 같은 결과 (결정적)', () => {
    const play = () => {
      const s = newGame(77);
      s.tutorial = false;
      startDay(s);
      const ev: SimEvent[] = [];
      while (s.phase !== 'settle') step(s, ev);
      return JSON.stringify(s.lastReport);
    };
    expect(play()).toBe(play());
  });

  it('상태는 JSON 으로 직렬화·복원된다', () => {
    const { s } = openDay(4);
    run(s, 10);
    const copy = JSON.parse(JSON.stringify(s));
    run(s, 5);
    run(copy, 5);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(s));
  });
});
