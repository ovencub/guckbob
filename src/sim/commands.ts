// 플레이어 명령 (입력은 이 함수들로만 sim 에 들어온다)
import type { MenuId } from '../data/menus';
import { takeOrder as takeOrderInner } from './customers';
import { clean as cleanInner, collect as collectInner, serve as serveInner, startCook as cookInner, wash as washInner } from './kitchen';
import { PLAYER, playerTaste, unlockedMenus } from './state';
import type { GameState, SimEvent } from './types';

const live = (s: GameState) => s.dayState !== null && (s.phase === 'open' || s.phase === 'overtime');

export function takeOrder(s: GameState, table: number, ev: SimEvent[]): boolean {
  return live(s) && takeOrderInner(s, table, PLAYER, (e) => ev.push(e));
}
export function startCook(s: GameState, burner: number, menu: MenuId, ev: SimEvent[]): boolean {
  return live(s) && cookInner(s, burner, menu, PLAYER, playerTaste(s), 1, (e) => ev.push(e));
}
export function collect(s: GameState, burner: number, ev: SimEvent[]): boolean {
  return live(s) && collectInner(s, burner, (e) => ev.push(e));
}
export function serve(s: GameState, slot: number, ev: SimEvent[], table = -1): boolean {
  return live(s) && serveInner(s, slot, (e) => ev.push(e), table);
}
export function clean(s: GameState, table: number, ev: SimEvent[]): boolean {
  return live(s) && cleanInner(s, table, (e) => ev.push(e));
}
export function wash(s: GameState, ev: SimEvent[]): boolean {
  return live(s) && washInner(s, (e) => ev.push(e));
}

/** 테이블 탭: 주문 받기 또는 치우기 */
export function tapTable(s: GameState, table: number, ev: SimEvent[]): boolean {
  if (!live(s)) return false;
  const tb = s.dayState!.tables[table];
  if (tb.dirty) return clean(s, table, ev);
  return takeOrder(s, table, ev);
}

/** 화구 탭: 완료면 배식대로, 비었으면 (메뉴가 하나뿐이면) 바로 조리. 반환 'menu' = 메뉴 선택 필요 */
export function tapBurner(s: GameState, burner: number, ev: SimEvent[]): boolean | 'menu' {
  if (!live(s)) return false;
  const b = s.dayState!.burners[burner];
  if (!b) return false;
  if (b.phase === 'done') return collect(s, burner, ev);
  if (b.phase !== 'empty') return false;
  const ms = unlockedMenus(s);
  if (ms.length === 1) return startCook(s, burner, ms[0], ev);
  return 'menu';
}
