// 기술 개발 (GDD 9장)
export const TASTE_RESEARCH = {
  costs: [50000, 90000, 150000, 250000],
  // 레벨 n(1부터)을 연구하려면 고용 중인 주방장 최고 등급이 이 값 이상 (0 = 견습이라도 1명 이상)
  needChefGrade: [0, 1, 2, 3],
} as const;

export const COST_RESEARCH = {
  costs: [60000, 100000, 160000, 240000, 400000],
  cutPerLevel: 0.07,
} as const;
