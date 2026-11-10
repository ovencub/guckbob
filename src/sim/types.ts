// 시뮬레이션 상태 타입. 전부 평범한 객체 → JSON 으로 저장·복원 가능.
import type { MenuId } from '../data/menus';
import type { PromoId } from '../data/promos';
import type { Grade, StaffRole } from '../data/staff';
import type { Vec2 } from './geometry';

export type Phase = 'prep' | 'countdown' | 'open' | 'overtime' | 'settle' | 'ended';

export interface StaffMember { id: number; role: StaffRole; grade: Grade; name: string; fur: number }

export interface Stats {
  teams: number; guests: number; bowls: number; revenue: number; bestDay: number;
  burnt: number; angry: number; missed: number;
}

export interface DayReport {
  day: number; revenue: number; sold: number; ingredients: number;
  wages: Array<{ name: string; role: StaffRole; grade: Grade; wage: number }>;
  rent: number; utility: number; promo: number; net: number;
  teams: number; guests: number; missed: number; angry: number; burnt: number;
  reviewAvg: number; reviewCount: number; ratingBefore: number; ratingAfter: number;
  tierBefore: number; tierAfter: number; vip: 'none' | 'pass' | 'fail';
  bowlZeroSec: number; sinkFullSec: number; peakQueue: number; burnedByPlayer: number; angryTeams: number;
}

export interface Dish { id: number; menu: MenuId; taste: number }

export interface OrderItem { menu: MenuId; member: number; served: boolean; dish: Dish | null; kind: number; eatT: number; reserved: number }

export type TeamState = 'queue' | 'entering' | 'seated' | 'leaving' | 'gone';

export interface Team {
  id: number; size: number; vip: boolean; tourist: boolean; scripted: boolean;
  state: TeamState; table: number; members: number[];
  orders: OrderItem[]; orderTaken: boolean; seatedT: number; patience: number;
  arriveT: number; queuePatience: number; lastServedT: number; doneP: number;
  kioskAt: number; angry: boolean; spawnLeft: number;
}

export type CatKind = 'guest' | 'chef' | 'server' | 'dish';
export type CatState =
  | 'queue' | 'spawnWait' | 'toSeat' | 'enterSeat' | 'sitting' | 'seated' | 'standing' | 'exitSeat' | 'toExit' | 'gone'
  | 'idle' | 'walk' | 'act';

export interface Cat {
  id: number; kind: CatKind; team: number; staff: number; seat: number;
  x: number; z: number; ry: number; y: number; px: number; pz: number; pry: number; py: number;
  state: CatState; stateT: number; path: Vec2[]; goal: Vec2 | null; speed: number;
  blockedT: number; bestD: number; blockedBy: number; lookSec: number; replanSec: number; dodgeT: number; moving: boolean; free: boolean; fur: number; scarf: number;
  // 직원
  task: ServerTask | null; carry: Dish[]; actT: number;
}

export type ServerTask =
  | { k: 'pick'; slots: number[]; to: Vec2 }
  | { k: 'deliver'; table: number; to: Vec2 }
  | { k: 'order'; table: number; to: Vec2 }
  | { k: 'clean'; table: number; to: Vec2 }
  | { k: 'home'; to: Vec2 };

export interface TableState {
  id: number; team: number; dirty: boolean; coins: number; bowls: number;
  seatDish: Array<{ menu: MenuId | 'dirty'; eaten: boolean } | null>;
  orderBy: number; cleanBy: number;
}

export type BurnerPhase = 'empty' | 'cooking' | 'done' | 'burnt';
export interface BurnerState { phase: BurnerPhase; menu: MenuId; t: number; dur: number; by: number; taste: number; dishId: number }

export interface DayState {
  t: number; overT: number; nextArrival: number; scriptedLeft: number; scriptedNext: number;
  vipAt: number; vipDone: boolean; vipScore: number;
  teams: Team[]; cats: Cat[]; queue: number[]; tables: TableState[];
  burners: BurnerState[]; pass: Array<(Dish & { by: number; res: number; at: number }) | null>; sink: number; clean: number;
  washCd: number; dishT: number; nextId: number;
  revenue: number; sold: number; ingredients: number; reviews: number[];
  teamsServed: number; guests: number; missed: number; angry: number; burnt: number; burnedByPlayer: number;
  bowlZeroSec: number; sinkFullSec: number; peakQueue: number; comboN: number; comboT: number; ratingOpen: number; washed: number;
}

export interface Promo { id: PromoId; days: number }

export interface GameState {
  version: number; seed: number; rng: number;
  phase: Phase; day: number; money: number; shopName: string;
  stage: number; burners: number; bowls: number; sinkLevel: number; kiosk: boolean;
  menus: Record<MenuId, boolean>; staff: StaffMember[]; nextStaffId: number;
  taste: number; costCut: number;
  promos: Promo[]; bought: Array<{ id: PromoId; cost: number }>;
  tier: number; tierDays: number[]; reviews: number[]; revenues: number[];
  vipOk: boolean; ended: boolean; endless: boolean; michelinDay: number;
  stats: Stats; tutorial: boolean; playSec: number;
  lastReport: DayReport | null; history: DayReport[];
  dayState: DayState | null;
}

export type SimEvent =
  | { k: 'arrive'; team: number } | { k: 'queueFull'; team: number } | { k: 'queueLeave'; team: number }
  | { k: 'seated'; team: number } | { k: 'order'; table: number; by: number }
  | { k: 'cook'; burner: number; by: number } | { k: 'cookDone'; burner: number } | { k: 'burn'; burner: number }
  | { k: 'toPass'; burner: number; slot: number } | { k: 'serve'; slot: number; table: number; seat: number; by: number; menu: MenuId; from?: Vec2 }
  | { k: 'eatDone'; table: number; seat: number } | { k: 'leave'; team: number; table: number; happy: boolean }
  | { k: 'angry'; team: number; table: number } | { k: 'paid'; table: number; amount: number; by: number }
  | { k: 'review'; score: number; vip: boolean; table: number } | { k: 'wash'; by: number } | { k: 'toast'; msg: string }
  | { k: 'nope'; what: 'burner' | 'pass' | 'table' | 'sink'; id: number } | { k: 'poof'; x: number; z: number; y: number }
  | { k: 'combo'; n: number } | { k: 'close' } | { k: 'dayEnd' } | { k: 'open' } | { k: 'vipArrive'; team: number };
