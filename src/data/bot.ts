// 밸런스 봇 설정 (BUILD_PLAN 6단계)
export const BOT = {
  reactionSec: 0.4,
  menuPickCost: 2,      // 메뉴가 여럿이면 화구 탭 + 메뉴 탭 = 2행동
  reserveShare: 0.5,    // 하루 고정비의 50%는 남기고 산다 (진행 모델과 같음)
  passWaitSec: 6.0,     // 서버가 있어도 배식대에 이만큼 남은 국밥은 직접 서빙
  urgentRatio: 0.38,     // 인내심을 이만큼 쓴 테이블은 직접 서빙
  vipRating: 4.4,
  vipTier: 4,
  targetDays: [19, 23] as readonly [number, number],
  targetMinutes: [52, 65] as readonly [number, number],
} as const;

// 진행 모델 PLAN 과 같은 순서. id 는 정비 화면 구매 id, 'up:역할:등급' 은 등급 올리기. tier = 필요한 티어 index
export const BOT_PLAN: ReadonlyArray<{ id: string; tier: number }> = [
  // 초반: 키오스크(주문 자동)부터 → 그릇·메뉴·화구, 직원은 계약금을 모은 뒤 (2026-11-10 사람 기준 재조정)
  { id: 'kiosk', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'menu:spicy', tier: 0 }, { id: 'burner', tier: 0 }, { id: 'hire:server:0', tier: 0 },
  { id: 'hire:chef:0', tier: 0 }, { id: 'taste', tier: 0 }, { id: 'sink', tier: 0 }, { id: 'bowls', tier: 0 },
  { id: 'stage', tier: 0 }, { id: 'up:chef:1', tier: 0 }, { id: 'up:server:1', tier: 0 }, { id: 'taste', tier: 0 }, { id: 'menu:suyuk', tier: 1 },
  { id: 'hire:dish:0', tier: 0 }, { id: 'burner', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'cost', tier: 0 },
  { id: 'hire:chef:1', tier: 0 }, { id: 'promo:google', tier: 1 },
  { id: 'stage', tier: 1 }, { id: 'up:chef:2', tier: 1 }, { id: 'up:server:2', tier: 1 }, { id: 'hire:server:2', tier: 1 }, { id: 'taste', tier: 2 }, { id: 'sink', tier: 0 },
  { id: 'burner', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'cost', tier: 0 }, { id: 'up:dish:2', tier: 1 },
  { id: 'promo:youtube', tier: 2 },
  { id: 'stage', tier: 2 }, { id: 'up:chef:3', tier: 2 }, { id: 'up:server:3', tier: 2 }, { id: 'hire:chef:3', tier: 2 }, { id: 'taste', tier: 3 }, { id: 'burner', tier: 0 },
  { id: 'sink', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 }, { id: 'bowls', tier: 0 },
  { id: 'up:dish:3', tier: 2 }, { id: 'cost', tier: 0 }, { id: 'promo:vip', tier: 4 },
];
