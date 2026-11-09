// 화면·카메라·연출 시간 (ART.md 2장, GDD 15장). 템포 수치는 GDD 값보다 느리게 바꾸지 않는다.
export const CAMERA = {
  pitchDeg: 46,
  yawDeg: 10,
  dist: 40,
  boundsTop: 2.2,
  topMargin: 0.19,     // 상단 HUD
  botMargin: 0.1,      // 하단 버튼
  sideCrop: 0.04,      // 좌우 최대 4% 잘림 허용
  minPxPerTile: 44,    // 1칸(화구 간격) = 44px 이상 → 탭 대상 최소 44px
  zoomMin: 0.8,
  zoomMax: 1.6,
  maxDpr: 2,
  lowFpsThreshold: 40, // 5초 평균 fps 가 이보다 낮으면 픽셀 비율 1
  fpsWindowSec: 5,
} as const;

export const LIGHT = {
  // 레퍼런스(r128, 레거시 조명) 값 × π = 최신 three 물리 조명에서 같은 밝기
  ambient: 0.52,
  sun: 0.56,
  legacyScale: Math.PI,
  sunPos: [-4, 10, 7] as readonly [number, number, number],
  bg: 0xf4e3c6,
} as const;

export const TIMING = {
  flySec: 0.2,           // 국밥 날아가기
  coinFlySec: 0.35,      // 동전 → HUD
  countUpSec: 0.4,       // 돈 숫자 카운트업
  popupSec: 0.12,        // 화구 메뉴 팝업
  tapBounceSec: 0.12,    // 탭 반응 0.9 → 1.05 → 1
  screenSec: 0.25,       // 화면 전환
  tierUpSec: 2,          // 티어 업 연출
  receiptLineSec: 0.15,  // 영수증 줄당
  receiptMaxSec: 3,
  endingSec: 6,
  startBannerSec: 1,
  expandSec: 0.6,        // 벽이 밀려나는 확장 연출
  toastSec: 1.4,
  popTextSec: 0.8,
  poofSec: 0.5,
  reviewPopSec: 1.2,
  comboSec: 0.9,
  shakeSec: 0.25,
} as const;

// 입력 (BUILD_PLAN 3단계)
export const INPUT = {
  tapSlopPx: 8,          // 탭/드래그 판정 거리
  minHitPx: 44,
} as const;

// 봇·플레이 시간 계산용 정비 시간 가정 (BUILD_PLAN 6단계)
export const PLAYTIME = {
  prepBaseSec: 15,
  prepPerBuySec: 4,
} as const;
