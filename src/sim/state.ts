// 상태 생성과 파생 값 (형상·격자 캐시, 맛 레벨, 용량)
import { ARRIVAL, DAY, PROMO_CAP, TASTE } from '../data/balance';
import { BOWLS, BURNERS, SINKS } from '../data/facilities';
import { KITCHEN } from '../data/balance';
import { MENU_BY_ID, type MenuId } from '../data/menus';
import { PROMO_BY_ID } from '../data/promos';
import { CHEF, DISH, SERVER } from '../data/staff';
import { TIERS } from '../data/tiers';
import { computeLayout, type LayoutGeo } from './geometry';
import { buildGrid, type Grid } from './grid';
import type { Cat, DayState, GameState, StaffMember, TableState } from './types';

export const SAVE_VERSION = 1;
export const PLAYER = -1; // 'by' 값: 플레이어

const geoCache = new Map<number, LayoutGeo>();
const gridCache = new Map<number, Grid>();
export function geoOf(stage: number): LayoutGeo {
  let g = geoCache.get(stage);
  if (!g) { g = computeLayout(stage); geoCache.set(stage, g); }
  return g;
}
export function gridOf(stage: number): Grid {
  let g = gridCache.get(stage);
  if (!g) { g = buildGrid(geoOf(stage)); gridCache.set(stage, g); }
  return g;
}

export function newGame(seed: number, shopName = '고양이 국밥'): GameState {
  return {
    version: SAVE_VERSION, seed, rng: seed | 0,
    phase: 'prep', day: 1, money: DAY.startMoney, shopName,
    stage: 0, burners: BURNERS.start, bowls: BOWLS.start, sinkLevel: 0, kiosk: false,
    menus: { sundae: true, spicy: false, suyuk: false }, staff: [], nextStaffId: 1,
    taste: 0, costCut: 0, promos: [], bought: [],
    tier: 0, tierDays: [1], reviews: [], revenues: [],
    vipOk: false, ended: false, endless: false, michelinDay: 0,
    stats: { teams: 0, guests: 0, bowls: 0, revenue: 0, bestDay: 0, burnt: 0, angry: 0, missed: 0 },
    tutorial: true, playSec: 0, lastReport: null, history: [], dayState: null,
  };
}

export const sinkCap = (s: GameState): number => SINKS[s.sinkLevel].slots;
export const passCap = (s: GameState): number => s.burners * KITCHEN.passPerBurner;
export const chefs = (s: GameState): StaffMember[] => s.staff.filter((m) => m.role === 'chef');
export const servers = (s: GameState): StaffMember[] => s.staff.filter((m) => m.role === 'server');
export const dishwasher = (s: GameState): StaffMember | undefined => s.staff.find((m) => m.role === 'dish');

export function rating(s: GameState): number {
  if (!s.reviews.length) return 0;
  return s.reviews.reduce((a, b) => a + b, 0) / s.reviews.length;
}
/** 화면 표시와 같은 소수 첫째 자리 */
export const ratingShown = (s: GameState): number => Math.round(rating(s) * 10) / 10;

export const chefTaste = (s: GameState, m: StaffMember): number => Math.min(TASTE.max, CHEF.skill[m.grade] + s.taste);
export function playerTaste(s: GameState): number {
  const cs = chefs(s);
  if (!cs.length) return Math.min(TASTE.max, TASTE.min + Math.floor(s.taste / 2));
  const best = Math.max(...cs.map((c) => chefTaste(s, c)));
  return Math.max(TASTE.min, best - 1);
}
export const priceOf = (menu: MenuId, taste: number): number => Math.round(MENU_BY_ID[menu].price * (1 + TASTE.pricePerLevel * (taste - 1)));
export const kindnessOf = (s: GameState, by: number): number => {
  if (by === PLAYER) return TASTE.playerKindness;
  const m = s.staff.find((x) => x.id === by);
  return m ? SERVER.kindness[m.grade] : TASTE.playerKindness;
};
export const washSecOf = (m: StaffMember): number => DISH.washSec[m.grade];

export function promoBonus(s: GameState): number {
  return Math.min(PROMO_CAP, s.promos.reduce((a, p) => a + PROMO_BY_ID[p.id].bonus, 0));
}
export const tierMult = (s: GameState): number => TIERS[s.tier].mult;
/** 분당 손님 팀 수 λ (GDD 4.1) */
export const arrivalRate = (s: GameState): number =>
  (ARRIVAL.basePerMin + ARRIVAL.perStarPerMin * ratingShown(s)) * (1 + promoBonus(s)) * tierMult(s);
export const queuePatience = (s: GameState): number => ARRIVAL.queuePatienceBase + ARRIVAL.queuePatiencePerStar * ratingShown(s);
export const maxTableCap = (s: GameState): number => Math.max(...geoOf(s.stage).tables.map((t) => t.cap));
export const unlockedMenus = (s: GameState): MenuId[] => (Object.keys(s.menus) as MenuId[]).filter((k) => s.menus[k]);

export function newDayState(s: GameState): DayState {
  const g = geoOf(s.stage);
  const tables: TableState[] = g.tables.map((t) => ({
    id: t.id, team: -1, dirty: false, coins: 0, bowls: 0, seatDish: t.seats.map(() => null), orderBy: 0, cleanBy: 0,
  }));
  return {
    t: 0, overT: 0, nextArrival: ARRIVAL.firstArrivalSec, scriptedLeft: 0, scriptedNext: 0,
    vipAt: -1, vipDone: false, vipScore: -1,
    teams: [], cats: [], queue: [], tables,
    burners: Array.from({ length: s.burners }, () => ({ phase: 'empty' as const, menu: 'sundae' as MenuId, t: 0, dur: 0, by: PLAYER, taste: 1, dishId: 0 })),
    pass: Array.from({ length: passCap(s) }, () => null), sink: 0, clean: s.bowls,
    washCd: 0, dishT: 0, nextId: 1,
    revenue: 0, sold: 0, ingredients: 0, reviews: [],
    teamsServed: 0, guests: 0, missed: 0, angry: 0, burnt: 0, burnedByPlayer: 0,
    bowlZeroSec: 0, sinkFullSec: 0, peakQueue: 0, comboN: 0, comboT: 0, ratingOpen: rating(s), washed: 0, teleports: 0,
  };
}

export function blankCat(id: number, kind: Cat['kind'], x: number, z: number, ry: number): Cat {
  return {
    id, kind, team: -1, staff: -1, seat: -1, x, z, ry, y: 0, px: x, pz: z, pry: ry, py: 0,
    state: 'idle', stateT: 0, path: [], goal: null, speed: 0, blockedT: 0, bestD: Infinity, blockedBy: -1, lookSec: 0, replanSec: 0, dodgeT: 0, passSide: 0, passT: 0, moving: false, free: false, fur: 0, scarf: 0,
    task: null, carry: [], actT: 0,
  };
}
