// 메뉴 (GDD 8장, 4.2장)
export type MenuId = 'sundae' | 'spicy' | 'suyuk';

export interface MenuDef {
  id: MenuId;
  name: string;
  short: string;
  price: number;
  cost: number;
  cookSec: number;
  unlockCost: number;    // 0 = 기본
  needTier: number;      // 해금에 필요한 티어 index
  weight: number;        // 주문 가중치
  minTeam: number;       // 이 인원 이상 팀만 주문
  maxPerTeam: number;    // 팀당 최대 (0 = 제한 없음)
}

export const MENUS: readonly MenuDef[] = [
  { id: 'sundae', name: '순대국밥', short: '순대', price: 9000, cost: 3600, cookSec: 3.0, unlockCost: 0, needTier: 0, weight: 50, minTeam: 1, maxPerTeam: 0 },
  { id: 'spicy', name: '얼큰순대국밥', short: '얼큰', price: 10000, cost: 4000, cookSec: 3.5, unlockCost: 45000, needTier: 0, weight: 35, minTeam: 1, maxPerTeam: 0 },
  { id: 'suyuk', name: '수육', short: '수육', price: 24000, cost: 10000, cookSec: 5.0, unlockCost: 200000, needTier: 1, weight: 15, minTeam: 2, maxPerTeam: 1 },
];

export const MENU_IDS: readonly MenuId[] = MENUS.map((m) => m.id);
export const MENU_BY_ID: Record<MenuId, MenuDef> = Object.fromEntries(MENUS.map((m) => [m.id, m])) as Record<MenuId, MenuDef>;
