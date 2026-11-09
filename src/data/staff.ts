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
  wage: [30000, 50000, 80000, 120000],
} as const;

export const SERVER = {
  max: 2,
  speed: [3.5, 4.5, 5.5, 6.5],   // 칸/초
  carry: [1, 2, 2, 3],
  kindness: [4, 6, 8, 10],
  wage: [25000, 40000, 65000, 100000],
  actionSec: 0.2,                // 집기·놓기·주문·치우기
} as const;

export const DISH = {
  max: 1,
  washSec: [0.9, 0.6, 0.4, 0.25],
  wage: [20000, 30000, 45000, 60000],
} as const;

export const ROLE_NAMES: Record<StaffRole, string> = { chef: '주방장', server: '서버', dish: '설거지 알바' };
export const ROLE_MAX: Record<StaffRole, number> = { chef: CHEF.max, server: SERVER.max, dish: DISH.max };
export const ROLE_WAGE: Record<StaffRole, readonly number[]> = { chef: CHEF.wage, server: SERVER.wage, dish: DISH.wage };

// 직원 이름 (고양이). 고용 순서대로 돌아가며 쓴다
export const STAFF_NAMES = ['나비', '치즈', '까망', '보리', '두부', '망고', '호떡', '감자', '모찌', '콩이', '깨비', '우유'] as const;
