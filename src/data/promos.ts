// 홍보 (GDD 10장). 정비 시간에 사면 다음 영업부터 적용
export type PromoId = 'flyer' | 'blog' | 'google' | 'youtube' | 'tv' | 'vip';

export interface PromoDef {
  id: PromoId;
  name: string;
  cost: number;
  bonus: number;     // 손님 증가 (0.2 = +20%)
  days: number;
  needTier: number;
  needRating: number;
  desc: string;
  warn?: string;
}

export const PROMOS: readonly PromoDef[] = [
  { id: 'flyer', name: '전단지', cost: 15000, bonus: 0.2, days: 1, needTier: 0, needRating: 0, desc: '손님 +20% · 1일' },
  { id: 'blog', name: '블로그 리뷰', cost: 50000, bonus: 0.35, days: 2, needTier: 0, needRating: 0, desc: '손님 +35% · 2일' },
  { id: 'google', name: '구글 광고', cost: 80000, bonus: 0.45, days: 3, needTier: 1, needRating: 0, desc: '손님 +45% · 3일' },
  { id: 'youtube', name: '유튜브 출연', cost: 150000, bonus: 0.7, days: 3, needTier: 2, needRating: 0, desc: '손님 +70% · 3일' },
  { id: 'tv', name: 'TV 출연', cost: 900000, bonus: 1.1, days: 4, needTier: 3, needRating: 4.0, desc: '손님 +110% · 4일', warn: '손님이 너무 많으면 손이 모자라 별점이 떨어질 수 있어요' },
  { id: 'vip', name: '귀빈 방문', cost: 600000, bonus: 0, days: 1, needTier: 4, needRating: 4.5, desc: '귀빈 1팀 · 리뷰 4.5 이상이면 귀빈 인정' },
];

export const PROMO_BY_ID: Record<PromoId, PromoDef> = Object.fromEntries(PROMOS.map((p) => [p.id, p])) as Record<PromoId, PromoDef>;
