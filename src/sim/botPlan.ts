// 봇의 정비 시간 구매 전략: tools/progression_model.py 의 PLAN 순서와 같다 (TV 출연 안 삼, 귀빈은 별점 4.5 이상일 때, 실패하면 재도전)
import { BOT_PLAN, BOT } from '../data/bot';
import type { Grade, StaffRole } from '../data/staff';
import { buy, offers, regrade, regradeCost } from './catalog';
import { utilityCost, wagesOf } from './economy';
import { STAGES } from '../data/layouts';
import { ratingShown } from './state';
import type { GameState } from './types';

export interface PlanCursor { i: number }

function dailyCost(s: GameState): number {
  return wagesOf(s).reduce((a, w) => a + w.wage, 0) + STAGES[s.stage].rent + utilityCost(s);
}

function priceOf(s: GameState, id: string): number {
  return offers(s).find((o) => o.id === id)?.cost ?? 0;
}

/** 오늘 산 개수를 돌려준다 */
export function botShop(s: GameState, cur: PlanCursor, log?: string[]): number {
  let buys = 0;
  while (cur.i < BOT_PLAN.length) {
    const step = BOT_PLAN[cur.i];
    if (s.tier < step.tier) break;
    if (step.id === 'promo:vip' && ratingShown(s) < BOT.vipRating) break;
    const reserve = dailyCost(s) * BOT.reserveShare;
    const [kind, role, g] = step.id.split(':');
    if (kind === 'up') {
      // 등급 올리기: 그 역할 직원 전부를 이 등급 이상으로
      const ups = s.staff.filter((m) => m.role === (role as StaffRole) && m.grade < Number(g));
      const cost = ups.reduce((a, m) => a + regradeCost(s, m.id, Number(g) as Grade), 0);
      if (s.money - cost < reserve) break;
      for (const m of ups) regrade(s, m.id, Number(g) as Grade);
      cur.i++; buys++; log?.push(step.id);
      continue;
    }
    const price = priceOf(s, step.id);
    if (s.money - price < reserve) break;
    if (!buy(s, step.id)) break;
    cur.i++; buys++; log?.push(step.id);
  }
  // 계획을 다 했는데 귀빈 인정이 아직이면 재도전
  if (cur.i >= BOT_PLAN.length && !s.vipOk && s.tier >= BOT.vipTier && ratingShown(s) >= BOT.vipRating) {
    if (buy(s, 'promo:vip')) { buys++; log?.push('promo:vip(재)'); }
  }
  return buys;
}
