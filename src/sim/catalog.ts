// 정비 시간 구매 목록: 직원·시설·메뉴·연구·홍보 (GDD 6~10장). 잠금 이유를 함께 돌려준다.
import { BOWLS, BURNERS, KIOSK, SINKS } from '../data/facilities';
import { STAGES } from '../data/layouts';
import { MENUS } from '../data/menus';
import { PROMOS, type PromoId } from '../data/promos';
import { COST_RESEARCH, TASTE_RESEARCH } from '../data/research';
import { CHEF, DISH, GRADE_NAMES, GRADE_NEED_TIER, GRADES, ROLE_MAX, ROLE_NAMES, ROLE_WAGE, SERVER, STAFF_NAMES, type Grade, type StaffRole } from '../data/staff';
import { TIERS } from '../data/tiers';
import { randInt } from './rng';
import { ratingShown } from './state';
import type { GameState } from './types';
import { LOOKS } from '../data/balance';

export type Tab = 'staff' | 'facility' | 'menu' | 'research' | 'promo';
export interface Offer {
  id: string; tab: Tab; name: string; desc: string; cost: number; wage?: number;
  ok: boolean; reason: string; owned?: boolean; action: string;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function staffDesc(role: StaffRole, g: Grade): string {
  if (role === 'chef') return `조리 ×${CHEF.speed[g]} · 맛 ${CHEF.skill[g]} · 화구 2개`;
  if (role === 'server') return `${SERVER.speed[g]}칸/초 · ${SERVER.carry[g]}그릇 · 친절 ${SERVER.kindness[g]}`;
  return `그릇 1개 ${DISH.washSec[g]}초`;
}

export function offers(s: GameState): Offer[] {
  const out: Offer[] = [];
  const add = (o: Omit<Offer, 'ok' | 'reason'> & { lock?: string }) => {
    const lock = o.lock ?? (o.cost > s.money ? '돈이 모자라요' : '');
    out.push({ ...o, ok: !lock, reason: lock });
  };
  // 직원: 역할별 등급 고용
  for (const role of ['chef', 'server', 'dish'] as StaffRole[]) {
    const have = s.staff.filter((m) => m.role === role).length;
    for (const g of GRADES) {
      const tierLock = s.tier < GRADE_NEED_TIER[g] ? `${TIERS[GRADE_NEED_TIER[g]].name} 이상` : '';
      add({
        id: `hire:${role}:${g}`, tab: 'staff', name: `${ROLE_NAMES[role]} ${GRADE_NAMES[g]}`, desc: staffDesc(role, g), cost: 0,
        wage: ROLE_WAGE[role][g], action: '고용', lock: tierLock || (have >= ROLE_MAX[role] ? `최대 ${ROLE_MAX[role]}명` : ''),
      });
    }
  }
  // 시설
  const nb = s.burners;
  if (nb < BURNERS.max) {
    const slots = STAGES[s.stage].burnerSlots;
    add({ id: 'burner', tab: 'facility', name: `화구 ${nb + 1}개째`, desc: '조리를 동시에 더', cost: BURNERS.costs[nb - BURNERS.start], action: '설치',
      lock: nb >= slots ? '가게를 넓혀야 자리가 나요' : undefined });
  }
  if (s.bowls < BOWLS.max) add({ id: 'bowls', tab: 'facility', name: `그릇 +${BOWLS.step}개`, desc: `지금 ${s.bowls}개 · 최대 ${BOWLS.max}개`, cost: BOWLS.cost, action: '구매' });
  if (s.sinkLevel < SINKS.length - 1) {
    const n = SINKS[s.sinkLevel + 1];
    add({ id: 'sink', tab: 'facility', name: `${n.name} 개수대`, desc: `${SINKS[s.sinkLevel].slots}칸 → ${n.slots}칸`, cost: n.cost, action: '교체' });
  }
  if (!s.kiosk) add({ id: 'kiosk', tab: 'facility', name: '키오스크', desc: '앉으면 0.6초 뒤 주문 자동 접수', cost: KIOSK.cost, action: '설치' });
  if (s.stage < STAGES.length - 1) {
    const n = STAGES[s.stage + 1];
    add({ id: 'stage', tab: 'facility', name: `가게 확장 ${s.stage + 2}단계`, desc: `테이블 ${n.tables.length}개 · 화구 칸 ${n.burnerSlots} · 임대료 ${won(n.rent)}/일`, cost: n.cost, action: '확장' });
  }
  // 메뉴
  for (const m of MENUS) {
    if (!m.unlockCost) continue;
    if (s.menus[m.id]) { out.push({ id: `menu:${m.id}`, tab: 'menu', name: m.name, desc: `${won(m.price)} · 조리 ${m.cookSec}초`, cost: 0, ok: false, reason: '', owned: true, action: '개발 완료' }); continue; }
    add({ id: `menu:${m.id}`, tab: 'menu', name: m.name, desc: `${won(m.price)} · 원가 ${won(m.cost)} · 조리 ${m.cookSec}초${m.minTeam > 1 ? ' · 2인 이상 팀' : ''}`,
      cost: m.unlockCost, action: '개발', lock: s.tier < m.needTier ? `${TIERS[m.needTier].name} 이상` : undefined });
  }
  // 연구
  if (s.taste < TASTE_RESEARCH.costs.length) {
    const lv = s.taste;
    const need = TASTE_RESEARCH.needChefGrade[lv];
    const best = Math.max(-1, ...s.staff.filter((m) => m.role === 'chef').map((m) => m.grade));
    add({ id: 'taste', tab: 'research', name: `맛 연구 Lv${lv + 1}`, desc: '맛 레벨 +1 (판매가 +4%, 별점↑)', cost: TASTE_RESEARCH.costs[lv], action: '개발',
      lock: best < need ? (need === 0 ? '주방장 1명 이상' : `${GRADE_NAMES[need]} 이상 주방장 필요`) : undefined });
  }
  if (s.costCut < COST_RESEARCH.costs.length) {
    add({ id: 'cost', tab: 'research', name: `원가 절감 Lv${s.costCut + 1}`, desc: `재료 원가 −${Math.round(COST_RESEARCH.cutPerLevel * 100)}%`, cost: COST_RESEARCH.costs[s.costCut], action: '개발' });
  }
  // 홍보
  const r = ratingShown(s);
  for (const p of PROMOS) {
    const active = s.promos.find((x) => x.id === p.id) || s.bought.find((x) => x.id === p.id);
    const lock = s.tier < p.needTier ? `${TIERS[p.needTier].name} 이상` : r < p.needRating ? `별점 ${p.needRating.toFixed(1)} 이상` : undefined;
    if (p.id === 'vip' && s.vipOk) continue;
    add({ id: `promo:${p.id}`, tab: 'promo', name: p.name, desc: p.desc + (p.warn ? ` · ${p.warn}` : ''), cost: p.cost, action: '구매',
      lock: lock ?? (active ? (s.bought.find((x) => x.id === p.id) ? '내일 적용' : `${s.promos.find((x) => x.id === p.id)!.days}일 남음`) : undefined) });
  }
  return out;
}

export function buy(s: GameState, id: string): boolean {
  const o = offers(s).find((x) => x.id === id);
  if (!o || !o.ok) return false;
  s.money -= o.cost;
  const [kind, a, b] = id.split(':');
  switch (kind) {
    case 'hire': hire(s, a as StaffRole, Number(b) as Grade); break;
    case 'burner': s.burners++; break;
    case 'bowls': s.bowls = Math.min(BOWLS.max, s.bowls + BOWLS.step); break;
    case 'sink': s.sinkLevel++; break;
    case 'kiosk': s.kiosk = true; break;
    case 'stage': s.stage++; break;
    case 'menu': s.menus[a as keyof GameState['menus']] = true; break;
    case 'taste': s.taste++; break;
    case 'cost': s.costCut++; break;
    case 'promo': s.money += o.cost; s.money -= o.cost; s.bought.push({ id: a as PromoId, cost: o.cost }); break;
    default: return false;
  }
  return true;
}

export function hire(s: GameState, role: StaffRole, grade: Grade): void {
  const id = s.nextStaffId++;
  s.staff.push({ id, role, grade, name: STAFF_NAMES[(id - 1) % STAFF_NAMES.length], fur: randInt(s, LOOKS.furKinds) });
}

export function fire(s: GameState, id: number): boolean {
  const i = s.staff.findIndex((m) => m.id === id);
  if (i < 0) return false;
  s.staff.splice(i, 1);
  return true;
}

/** 등급 바꾸기 (고용비가 없어 해고 후 재고용과 같다). 이름·무늬는 유지 */
export function regrade(s: GameState, id: number, grade: Grade): boolean {
  const m = s.staff.find((x) => x.id === id);
  if (!m || s.tier < GRADE_NEED_TIER[grade]) return false;
  m.grade = grade;
  return true;
}
