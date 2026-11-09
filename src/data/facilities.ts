// 시설 (GDD 7장)
export const BURNERS = {
  start: 2,
  max: 6,
  // 다음 화구(3개째, 4개째, ...) 비용
  costs: [60000, 225000, 450000, 750000],
} as const;

export const BOWLS = {
  start: 6,
  step: 2,
  cost: 25000,
  max: 30,
} as const;

export const SINKS = [
  { name: '소형', slots: 8, cost: 0 },
  { name: '중형', slots: 14, cost: 50000 },
  { name: '대형', slots: 22, cost: 225000 },
  { name: '업소용', slots: 32, cost: 525000 },
] as const;

export const KIOSK = { cost: 150000 } as const;

export const UTILITY = { base: 2000, perBurner: 2000 } as const;
