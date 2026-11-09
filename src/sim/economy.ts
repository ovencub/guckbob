// 정산과 티어 판정 (GDD 11장, 12장)
import { UTILITY } from '../data/facilities';
import { STAGES } from '../data/layouts';
import { ROLE_WAGE } from '../data/staff';
import { REVENUE_DAYS, TIERS, TIER_MICHELIN } from '../data/tiers';
import { rating } from './state';
import type { DayReport, GameState } from './types';

export function utilityCost(s: GameState): number { return UTILITY.base + UTILITY.perBurner * s.burners; }
export function wagesOf(s: GameState): DayReport['wages'] {
  return s.staff.map((m) => ({ name: m.name, role: m.role, grade: m.grade, wage: ROLE_WAGE[m.role][m.grade] }));
}

export const avgRevenue3 = (s: GameState): number => {
  const r = s.revenues.slice(-REVENUE_DAYS);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
};

/** 다음 티어 조건 충족 여부 */
export function tierReady(s: GameState, tier: number): boolean {
  const d = TIERS[tier];
  if (!d) return false;
  const r = Math.round(rating(s) * 10) / 10;
  return r >= d.rating && avgRevenue3(s) >= d.revenue3 && (!d.needVip || s.vipOk);
}

/** 영업이 끝난 뒤 정산. 돈은 영업 중 이미 들어왔으므로 비용만 뺀다 */
export function settle(s: GameState, ratingBefore: number): DayReport {
  const ds = s.dayState!;
  const wages = wagesOf(s);
  const wageSum = wages.reduce((a, w) => a + w.wage, 0);
  const rent = STAGES[s.stage].rent;
  const utility = utilityCost(s);
  const promo = s.bought.reduce((a, b) => a + b.cost, 0);
  const ingredients = Math.round(ds.ingredients);
  const net = ds.revenue - ingredients - wageSum - rent - utility - promo;
  s.money -= ingredients + wageSum + rent + utility;
  s.revenues.push(ds.revenue);
  s.stats.teams += ds.teamsServed; s.stats.guests += ds.guests; s.stats.bowls += ds.sold; s.stats.revenue += ds.revenue;
  s.stats.bestDay = Math.max(s.stats.bestDay, ds.revenue); s.stats.burnt += ds.burnt; s.stats.angry += ds.angry; s.stats.missed += ds.missed;
  const tierBefore = s.tier;
  while (s.tier < TIER_MICHELIN && tierReady(s, s.tier + 1)) {
    s.tier++;
    s.tierDays[s.tier] = s.day;
  }
  if (s.tier >= TIER_MICHELIN && !s.michelinDay) s.michelinDay = s.day;
  const reviewAvg = ds.reviews.length ? ds.reviews.reduce((a, b) => a + b, 0) / ds.reviews.length : 0;
  const report: DayReport = {
    day: s.day, revenue: ds.revenue, sold: ds.sold, ingredients, wages, rent, utility, promo, net,
    teams: ds.teamsServed, guests: ds.guests, missed: ds.missed, angry: ds.angry, burnt: ds.burnt,
    reviewAvg, reviewCount: ds.reviews.length, ratingBefore, ratingAfter: rating(s),
    tierBefore, tierAfter: s.tier, vip: ds.vipScore < 0 ? 'none' : s.vipOk && ds.vipScore >= 0 && ds.vipScore >= 4.5 ? 'pass' : 'fail',
    bowlZeroSec: ds.bowlZeroSec, sinkFullSec: ds.sinkFullSec, peakQueue: ds.peakQueue, burnedByPlayer: ds.burnedByPlayer,
    angryTeams: ds.teams.filter((t) => t.angry).length,
  };
  // 홍보: 오늘 쓴 것 1일 차감, 어제 정비 때 산 것은 이미 오늘부터 적용됨
  s.promos = s.promos.map((p) => ({ ...p, days: p.days - 1 })).filter((p) => p.days > 0);
  s.bought = [];
  s.lastReport = report;
  s.history.push(report);
  return report;
}
