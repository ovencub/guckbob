// 밸런스 봇 설정 (BUILD_PLAN 6단계)
export const BOT = {
  reactionSec: 0.4,
  menuPickCost: 2,      // 메뉴가 여럿이면 화구 탭 + 메뉴 탭 = 2행동
  targetDays: [19, 23] as readonly [number, number],
  targetMinutes: [52, 65] as readonly [number, number],
} as const;
