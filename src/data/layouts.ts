// 가게 레이아웃 (GDD 7장, ART.md 8장). 좌석·그릇·서비스 지점은 sim/geometry.ts 가 이 값과 규칙으로 계산한다.
// 좌표: x 오른쪽, z 앞(카메라 쪽), y 위. 단위 = 칸.

export type TableKind = 't2' | 't4' | 't6' | 't8';

export const TABLE_KINDS: Record<TableKind, { w: number; d: number; cols: number; seats: number }> = {
  t2: { w: 1.0, d: 0.9, cols: 1, seats: 2 },
  t4: { w: 1.7, d: 1.0, cols: 2, seats: 4 },
  t6: { w: 2.6, d: 1.0, cols: 3, seats: 6 },
  t8: { w: 3.5, d: 1.0, cols: 4, seats: 8 },
};

export interface TableSpec { kind: TableKind; x: number; z: number }

export interface StageSpec {
  cost: number;
  rent: number;
  left: number;        // 왼쪽 벽 안쪽 면 x
  front: number;       // 앞쪽 바닥 끝 z (입구)
  burnerSlots: number; // 이 단계 주방에 놓을 수 있는 화구 칸 수
  tables: TableSpec[];
}

// 1단계는 레퍼런스(design/style-preview.html)와 같은 좌표 (2인석만 좌석 진입을 위해 0.4칸 이동, 결정 로그).
// 확장할 때 테이블이 새 자리로 미끄러져 갈 수 있다(정비 시간이라 손님이 없다). 열 A(x≈-4.4)·B(≈-1.45)·C(≈1.3) 사이에 통로.
const T1: TableSpec = { kind: 't2', x: -1.2, z: -1.0 };
const T2: TableSpec = { kind: 't4', x: 1.25, z: 0.6 };
const T3: TableSpec = { kind: 't4', x: -1.45, z: 2.75 };
const N1: TableSpec = { kind: 't4', x: 1.3, z: 4.45 };

export const STAGES: readonly StageSpec[] = [
  { cost: 0, rent: 20000, left: -2.92, front: 5.0, burnerSlots: 3, tables: [T1, T2, T3] },
  {
    cost: 200000, rent: 35000, left: -3.92, front: 7.0, burnerSlots: 4,
    tables: [T1, T2, T3, N1, { kind: 't2', x: -3.35, z: 2.75 }],
  },
  {
    cost: 400000, rent: 60000, left: -4.92, front: 9.2, burnerSlots: 5,
    tables: [T1, T2, T3, N1, { kind: 't2', x: -3.9, z: 3.2 }, { kind: 't6', x: -2.5, z: 6.95 }, { kind: 't4', x: -3.75, z: -0.5 }],
  },
  {
    cost: 700000, rent: 110000, left: -5.92, front: 13.1, burnerSlots: 6,
    tables: [
      T1, T2, T3, N1, { kind: 't2', x: -1.1, z: 10.85 }, { kind: 't6', x: -3.5, z: 10.85 }, { kind: 't4', x: -4.4, z: -0.5 },
      { kind: 't8', x: -3.0, z: 7.05 }, { kind: 't4', x: 1.3, z: 8.25 }, { kind: 't4', x: -4.4, z: 3.25 },
    ],
  },
];

// 주방·배식대 (ART.md 5장, 8.2장)
export const KITCHEN_LAYOUT = {
  backWallZ: -5.05,
  wallT: 0.26,
  counterZ: -4.3,
  counterD: 0.95,
  counterH: 0.88,
  counterRight: 2.95,
  burnerY: 0.95,
  // 화구 칸 x (사는 순서대로). 1~3번은 레퍼런스 위치, 이후는 주방이 왼쪽으로 넓어진 자리
  burnerX: [0.15, 1.15, 2.15, -0.85, -1.85, -2.85],
  stackGap: 1.2,       // 가장 왼쪽 화구 칸 → 그릇 더미
  sinkGap: 2.35,       // 가장 왼쪽 화구 칸 → 개수대 중심
  sinkW: 1.35,
  chefGap: 0.47,       // 주방장은 조리대 앞면에서 0.47칸
  passZ: -2.3,
  passD: 0.6,
  passH: 0.82,
  passX0: -0.4,
  passX1: 2.6,
  passCols: 6,
  passColX0: -0.15,
  passColStep: 0.5,
  passRowZ: [-2.15, -2.45],
  passTopY: 0.89,
  serverPickGap: 0.7,  // 배식대 앞면에서 서버가 서는 거리 (돌아설 때 꼬리 0.67)
} as const;

export const DOOR = {
  x: 2.0,
  halfW: 0.85,
  spawnDx: -0.45,      // 들어오는 자리 (문 안쪽 왼쪽)
  exitDx: 0.45,        // 나가는 자리 (문 안쪽 오른쪽)
  inset: 0.55,         // 문에서 안쪽으로
} as const;

export const QUEUE = {
  firstX: 0.6,
  step: 1.1,           // 줄 간격 1.1칸
  barrierGap: 0.5,     // 차단봉에서 0.5칸
  barrierDz: 0.45,     // 바닥 끝 → 차단봉
} as const;

// 좌석·통로 규칙 (ART.md 8.2)
export const SEAT_RULES = {
  seatGap: 0.5,        // 의자 중심 = 테이블 가장자리에서 0.5칸 바깥
  seatSpacing: 0.9,    // 나란히 앉는 좌석 간격
  bowlInset: 0.2,      // 그릇 = 좌석 쪽 가장자리에서 0.2칸 안쪽
  serviceGap: 0.5,     // 서버 서비스 지점 = 테이블 끝에서 0.5칸
  approachDists: [0.9] as readonly number[], // 좌석으로 들어가기 전 서는 지점 (의자에서). 앞 값부터 시도
  stoolR: 0.2,
  stoolH: 0.42,
  tableTopY: 0.83,
  tableTopH: 0.11,
  seatY: 0.47,         // 앉은 고양이 높이
} as const;

// 고양이 크기 기준 (ART.md 8.1) — 겹침 검사와 경로 계산이 같은 값을 쓴다
export const CAT_DIM = {
  bodyR: 0.40,
  bodyY: 0.47,         // 서 있을 때 몸 중심 높이
  pawR: 0.1,
  pawFwd: 0.33,
  pawSide: 0.17,
  pawY: 0.17,
  tailR: 0.05,
  tailBack: 0.62,
  trayR: 0.24,
  trayY: 1.12,
  // 꼬리 곡선 제어점 (몸 중심 기준 x,y,z). 렌더러는 CatmullRom 으로, 검사기는 이 점들로 쓴다
  tail: [[0, 0.1, -0.34], [0, 0.15, -0.5], [0, 0.34, -0.57], [0, 0.53, -0.52], [0, 0.6, -0.42]] as ReadonlyArray<readonly [number, number, number]>,
  tailWag: 0.35,       // 꼬리 흔들기 최대 회전(rad)
  sep: 0.82,           // 고양이끼리 최소 중심 거리(수평). 몸 0.40 × 2 + 여유
  kitchenGap: 0.1,     // 홀 고양이는 주방 통로(주방장 줄)에서 sep + 이만큼 떨어진다
  frontInset: 0.3,     // 바닥 앞 끝(+0.1 턱)에서 몸이 넘지 않게
  walkClear: 0.53,     // 걷는 고양이 ↔ 의자 (앞발 0.47 + 돌아설 때 꼬리 여유)
  tailClear: 0.67,     // 걷는 고양이 ↔ 카운터·벽 (돌아설 때 꼬리 0.62 + 굵기 0.05)
  tableClear: 0.42,    // 걷는 고양이 ↔ 테이블 상판 (서버가 든 앞발 반경 0.3 + 0.1)
  gridCell: 0.125,     // A* 격자 (결정 로그: 0.5 → 0.125, 좁은 통로를 놓치지 않게)
  pathSample: 0.08,    // 직선 경로 검사 간격
} as const;

// 이동 (GDD 15장)
export const MOVE = {
  customerSpeed: 5,    // 칸/초
  angrySpeed: 7,       // 화나서 나가는 빠른 걸음
  serverHomeDelaySec: 1.5, // 일이 없으면 이만큼 기다렸다가 대기 자리로
  sitSec: 0.2,
  standSec: 0.2,
  turnSec: 0.1,
  hopDist: 0.5,        // 의자에서 이 거리 안이면 폴짝 올라탄다
  stuckReplanSec: 0.5,
  progressEps: 0.05,   // 목표까지 이만큼 가까워져야 '진행'으로 본다
  stuckPoofSec: 1.6,   // 끼어서 못 움직이면 손님은 연기와 함께 자리/출구로 (결정 로그)
  arriveEps: 0.04,
  sidestepDeg: [25, 50, 75, 100],
} as const;
