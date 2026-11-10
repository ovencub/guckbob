// 직원 (GDD 6장)
export type StaffRole = 'chef' | 'server' | 'dish';
export type Grade = 0 | 1 | 2 | 3; // 견습, 일반, 베테랑, 장인

export const GRADES: readonly Grade[] = [0, 1, 2, 3];
export const GRADE_NAMES = ['견습', '일반', '베테랑', '장인'] as const;
export const GRADE_NEED_TIER = [0, 0, 1, 2] as const; // 베테랑 = 동네 맛집, 장인 = 줄서는 맛집

export const CHEF = {
  max: 3,
  burnersEach: 2,
  speed: [1.0, 1.25, 1.5, 1.8],
  skill: [2, 3, 5, 6],
  wage: [50000, 75000, 100000, 135000],
} as const;

export const SERVER = {
  max: 2,
  speed: [3.5, 4.5, 5.5, 6.5],   // 칸/초
  carry: [1, 2, 2, 3],
  kindness: [4, 6, 8, 10],
  wage: [40000, 65000, 85000, 115000],
  actionSec: 0.2,                // 집기·놓기·주문·치우기
  // 길 찾기 실력: 손님 이동을 몇 초 앞까지 내다보고, 막히면 몇 초마다 길을 다시 짜는가 (등급이 높을수록 똑똑)
  lookSec: [0, 0.4, 0.8, 1.2],
  replanSec: [0.45, 0.3, 0.2, 0.12],
} as const;

export const DISH = {
  max: 1,
  washSec: [0.9, 0.6, 0.4, 0.25],
  wage: [30000, 45000, 55000, 70000],
} as const;

// 계약금 (일회성, 고용·승급 때). 근거는 docs/BALANCE_LOG.md "직원 가격"
export const HIRE = {
  feeDays: 2.5,       // 계약금 = 일당 × 2.5일
  roundTo: 5000,
} as const;
export const hireFee = (wage: number): number => Math.round((wage * HIRE.feeDays) / HIRE.roundTo) * HIRE.roundTo;

export const ROLE_NAMES: Record<StaffRole, string> = { chef: '주방장', server: '서버', dish: '설거지 알바' };
export const ROLE_MAX: Record<StaffRole, number> = { chef: CHEF.max, server: SERVER.max, dish: DISH.max };
export const ROLE_WAGE: Record<StaffRole, readonly number[]> = { chef: CHEF.wage, server: SERVER.wage, dish: DISH.wage };

// 직원 이름 (고양이). 고용 순서대로 돌아가며 쓴다
export const STAFF_NAMES = ['나비', '치즈', '까망', '보리', '두부', '망고', '호떡', '감자', '모찌', '콩이', '깨비', '우유'] as const;
