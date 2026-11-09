// 정비 화면 탭별 "추천" 1개: 어제의 병목에 맞는 구매 (GDD 16장)
import { RECOMMEND } from '../../data/recommend';
import type { Offer, Tab } from '../../sim/catalog';
import type { GameState } from '../../sim/types';

export function recommend(s: GameState, tab: Tab, list: Offer[]): Offer | null {
  const r = s.lastReport;
  const ok = (id: string) => list.find((o) => o.id === id && o.ok) ?? null;
  const firstOk = (pred: (o: Offer) => boolean) => list.find((o) => o.ok && pred(o)) ?? null;
  const has = (role: string) => s.staff.filter((m) => m.role === role).length;
  const best = (role: string) => {
    // 가장 높은 등급의 고용 가능 항목
    const xs = list.filter((o) => o.ok && o.id.startsWith(`hire:${role}:`));
    return xs.length ? xs[xs.length - 1] : null;
  };
  switch (tab) {
    case 'staff': {
      if (!r) return null;
      if ((r.burnedByPlayer >= RECOMMEND.burntForChef || r.peakQueue >= RECOMMEND.queueBusy) && has('chef') < 3) return best('chef');
      if (r.angryTeams >= RECOMMEND.angryForServer && has('server') < 2) return best('server');
      if (r.sinkFullSec + r.bowlZeroSec >= RECOMMEND.sinkTroubleSec && !has('dish')) return best('dish');
      return has('server') === 0 ? best('server') : has('chef') === 0 ? best('chef') : null;
    }
    case 'facility': {
      if (r && r.bowlZeroSec >= RECOMMEND.bowlZeroSec) return ok('bowls');
      if (r && r.sinkFullSec >= RECOMMEND.sinkTroubleSec) return ok('sink');
      if (r && r.peakQueue >= RECOMMEND.queueBusy) return ok('stage') ?? ok('burner');
      return ok('burner') ?? ok('bowls') ?? ok('kiosk');
    }
    case 'menu': return firstOk(() => true);
    case 'research': return ok('taste') ?? ok('cost');
    case 'promo': {
      // 손님이 남는 날(웨이팅 없음)에만 홍보 추천
      if (r && r.peakQueue >= RECOMMEND.queueBusy) return null;
      const xs = list.filter((o) => o.ok && o.id !== 'promo:tv');
      if (s.tier >= 4 && s.reviews.length && ok('promo:vip')) return ok('promo:vip');
      return xs.filter((o) => o.id !== 'promo:vip').sort((a, b) => b.cost - a.cost).find((o) => o.cost <= s.money * RECOMMEND.promoMoneyShare) ?? null;
    }
  }
}
