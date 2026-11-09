// 식당 티어 (GDD 11장). 정산 직후 판정, 강등 없음
export interface TierDef {
  name: string;
  rating: number;     // 가게 별점 이상
  revenue3: number;   // 최근 3일 평균 총매출 이상
  mult: number;       // 손님 배수
  needVip: boolean;
  unlocks: string;
}

export const TIERS: readonly TierDef[] = [
  { name: '소상공인', rating: 0, revenue3: 0, mult: 1.0, needVip: false, unlocks: '' },
  { name: '동네 맛집', rating: 1.5, revenue3: 160000, mult: 1.1, needVip: false, unlocks: '베테랑 직원 · 수육 · 구글 광고' },
  { name: '줄서는 맛집', rating: 2.4, revenue3: 400000, mult: 1.25, needVip: false, unlocks: '장인 직원 · 유튜브 출연' },
  { name: '블루리본', rating: 3.4, revenue3: 900000, mult: 1.4, needVip: false, unlocks: 'TV 출연 · 리본 간판' },
  { name: '관광맛집', rating: 4.0, revenue3: 1600000, mult: 1.6, needVip: false, unlocks: '귀빈 방문 · 관광객 고양이' },
  { name: '미슐랭', rating: 4.5, revenue3: 2300000, mult: 1.8, needVip: true, unlocks: '엔딩' },
];

export const REVENUE_DAYS = 3;
export const TIER_LOCAL = 1;
export const TIER_LINE = 2;
export const TIER_BLUE = 3;
export const TIER_TOURIST = 4;
export const TIER_MICHELIN = TIERS.length - 1;

// 결과 페이지 칭호 (일수 이하 → 칭호)
export const TITLES: ReadonlyArray<{ maxDays: number; name: string }> = [
  { maxDays: 16, name: '국밥의 신' },
  { maxDays: 19, name: '전설의 국밥 장인' },
  { maxDays: 22, name: '미슐랭 셰프' },
  { maxDays: 26, name: '골목의 자랑' },
  { maxDays: Number.POSITIVE_INFINITY, name: '끈기의 국밥집' },
];
