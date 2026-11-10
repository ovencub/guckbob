// 하루 흐름·손님·리뷰 등 핵심 규칙 수치 (GDD 3~5장). 코드에서 숫자를 직접 쓰지 말고 여기서 가져온다.
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export const DAY = {
  openSec: 120,          // 영업 시간 (게임 시계 11:00 → 21:00)
  clockStartMin: 11 * 60,
  clockEndMin: 21 * 60,
  overtimeSafetySec: 90, // 마감 후: 남은 손님이 다 먹고 나가고 테이블을 치워 계산해야 정산. 그래도 안 끝나면 이 시간 뒤 자동 정리(안전장치)
  countdownSec: 1,       // "영업 시작!" 배너
  bgmRushSec: 10,        // 마감 10초 전 BGM 템포 업
  startMoney: 0,
} as const;

export const ARRIVAL = {
  basePerMin: 7.0,       // λ = (base + perStar × 별점) × (1 + 홍보) × 티어 배수
  perStarPerMin: 3.0,
  minGapSec: 0.8,
  firstArrivalSec: 0.8,  // 영업 시작 후 첫 팀 도착 (결정 로그 참조)
  maxQueue: 6,
  queuePatienceBase: 10,
  queuePatiencePerStar: 5,
  // 팀 인원 가중치 (인원, 가중치)
  groupWeights: [[1, 30], [2, 34], [3, 14], [4, 12], [5, 4], [6, 3], [7, 2], [8, 1]] as ReadonlyArray<readonly [number, number]>,
} as const;

export const TABLE = {
  patienceBase: 22,      // 테이블 인내심 = base + perExtra × (주문 수 − 1)
  patiencePerExtra: 3,
  warnRatio: 0.5,        // 노랑 + 발 구르기
  dangerRatio: 0.8,      // 빨강 + 말풍선 흔들림
  eatSec: 5,
  kioskDelaySec: 0.6,
} as const;

export const KITCHEN = {
  burnSec: 3,            // 완료 후 탄내 카운트다운
  passPerBurner: 2,      // 배식대 칸 수 = 화구 수 × 2
  washCooldownSec: 0.15, // 개수대 탭 1번 = 1그릇
} as const;

export const REVIEW = {
  window: 50,            // 가게 별점 = 최근 50건 평균
  fastRatio: 0.4,        // p ≤ 0.4 이면 속도 계수 1
  slowFloor: 0.4,        // p = 1 일 때 속도 계수
  capBase: 0.5,
  capRange: 4.5,
  tasteWeight: 0.6,
  kindWeight: 0.4,
  normalShare: 0.8,      // 80%: Q + 삼각분포(±0.3)
  triHalf: 0.3,
  extremeMin: 0.4,       // 20%: Q ± 균등(0.4~0.9)
  extremeMax: 0.9,
  maxStars: 5,
  angryScore: 0,
  vipWeight: 10,         // 귀빈 리뷰는 10건으로 계산
  vipPass: 4.5,          // 귀빈 인정 기준
} as const;

export const TASTE = {
  min: 1,
  max: 10,
  pricePerLevel: 0.04,   // 판매가 = 가격 × (1 + 0.04 × (맛 − 1))
  playerKindness: 2,
  kindMax: 10,
} as const;

export const PROMO_CAP = 2.0; // 홍보 보너스 합 최대 +200%

export const VIP = {
  arriveMinSec: 20,
  arriveMaxSec: 60,
  size: 4,
} as const;

export const TUTORIAL = {
  teams: 3,              // 1일차 첫 3팀은 스크립트
  patienceMult: 2,
  teamSizes: [2, 1, 2] as readonly number[],
  gapSec: 5,             // 스크립트 팀 사이 간격
  maxSec: 60,
} as const;

export const COMBO = {
  windowSec: 1.6,        // 이 시간 안에 서빙·수금이 이어지면 콤보
} as const;

// 손님 무늬·목도리 종류 수 (모델 쪽 배열 길이와 같다)
export const LOOKS = { furKinds: 6, scarfKinds: 8 } as const;
