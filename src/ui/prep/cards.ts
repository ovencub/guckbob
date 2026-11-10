// 정비 화면 카드 그리기 (시설·메뉴·연구·홍보·직원 공통)
import { GRADE_NAMES, GRADE_NEED_TIER, ROLE_NAMES, ROLE_WAGE, type Grade } from '../../data/staff';
import { TIERS } from '../../data/tiers';
import { regradeCost, type Offer } from '../../sim/catalog';
import type { GameState } from '../../sim/types';
import { fmtMoney } from '../hud';

export const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function offerCard(o: Offer, rec: boolean): string {
  const price = o.wage !== undefined ? `계약금 ${fmtMoney(o.cost)} · 일당 ${fmtMoney(o.wage)}` : o.cost ? `${fmtMoney(o.cost)}원` : '';
  return `<div class="card${rec ? ' rec' : ''}${o.owned ? ' owned' : ''}">
    ${rec ? '<span class="rec-tag">추천</span>' : ''}
    <div class="cinfo"><b>${esc(o.name)}</b><small>${esc(o.desc)}</small>${price ? `<span class="price">${price}</span>` : ''}</div>
    ${o.owned ? `<span class="done">${esc(o.action)}</span>`
      : `<button class="btn buy tap" type="button" data-buy="${o.id}" ${o.ok ? '' : 'disabled'}>${o.ok ? esc(o.action) : `<small>${esc(o.reason)}</small>`}</button>`}
  </div>`;
}

export function staffCards(s: GameState, offers: Offer[], recId: string | null): string {
  const hired = s.staff.map((m) => {
    const grades = ([0, 1, 2, 3] as Grade[]).map((g) => {
      const locked = s.tier < GRADE_NEED_TIER[g];
      const cost = regradeCost(s, m.id, g);
      const poor = cost > s.money;
      return `<button class="chipbtn tap${g === m.grade ? ' on' : ''}" type="button" data-grade="${m.id}:${g}" ${locked || poor || g === m.grade ? 'disabled' : ''}
        title="${locked ? `${TIERS[GRADE_NEED_TIER[g]].name} 이상` : `${cost ? `승급 ${fmtMoney(cost)} · ` : ''}일당 ${fmtMoney(ROLE_WAGE[m.role][g])}`}">${GRADE_NAMES[g]}${cost && g !== m.grade ? `<small>${Math.round(cost / 1000)}k</small>` : ''}</button>`;
    }).join('');
    return `<div class="card staff"><div class="cinfo"><b>${esc(m.name)} <small>${ROLE_NAMES[m.role]} ${GRADE_NAMES[m.grade]}</small></b>
      <span class="price">일당 ${fmtMoney(ROLE_WAGE[m.role][m.grade])}</span><div class="grades">${grades}</div></div>
      <button class="btn fire tap" type="button" data-fire="${m.id}">해고</button></div>`;
  }).join('');
  const roles = (['chef', 'server', 'dish'] as const).map((role) => {
    const xs = offers.filter((o) => o.id.startsWith(`hire:${role}:`));
    const n = s.staff.filter((m) => m.role === role).length;
    const full = xs.every((o) => o.reason.startsWith('최대'));
    return `<div class="card hire${xs.some((o) => o.id === recId) ? ' rec' : ''}">
      ${xs.some((o) => o.id === recId) ? '<span class="rec-tag">추천</span>' : ''}
      <div class="cinfo"><b>${ROLE_NAMES[role]} 고용 <small>${n}명${full ? ' · 최대' : ''}</small></b><small>${esc(xs[1]?.desc ?? '')}</small></div>
      <div class="hire-grades">${xs.map((o) => `<button class="btn buy sm tap${o.id === recId ? ' hot' : ''}" type="button" data-buy="${o.id}" ${o.ok ? '' : 'disabled'}
        title="${esc(o.reason || `${o.desc} · 계약금 ${fmtMoney(o.cost)} · 일당 ${fmtMoney(o.wage ?? 0)}`)}">${GRADE_NAMES[Number(o.id.split(':')[2])]}<small>${o.ok ? `${Math.round(o.cost / 1000)}k · 일${Math.round((o.wage ?? 0) / 1000)}k` : esc(o.reason.replace(' 이상', '+').replace('돈이 모자라요', `${Math.round(o.cost / 1000)}k 필요`))}</small></button>`).join('')}</div>
    </div>`;
  }).join('');
  return `${hired ? `<div class="sub">일하는 고양이</div>${hired}` : ''}<div class="sub">고용 (계약금은 바로, 일당은 정산 때 · 승급은 계약금 차액)</div>${roles}`;
}
