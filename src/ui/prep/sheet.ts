// 정비 시간: 하단 시트 탭 5개(직원/시설/메뉴/연구/홍보) + 다음 티어 진행도 + "다음 영업하기" (GDD 16장)
import { TIERS, TIER_MICHELIN } from '../../data/tiers';
import { buy, fire, offers, regrade, type Tab } from '../../sim/catalog';
import { avgRevenue3 } from '../../sim/economy';
import { ratingShown } from '../../sim/state';
import type { GameState } from '../../sim/types';
import type { Grade } from '../../data/staff';
import { fmtMoney } from '../hud';
import { esc, offerCard, staffCards } from './cards';
import { recommend } from './recommend';

const TABS: Array<[Tab, string]> = [['staff', '직원'], ['facility', '시설'], ['menu', '메뉴'], ['research', '연구'], ['promo', '홍보']];

export class PrepSheet {
  private el: HTMLDivElement;
  private tab: Tab = 'staff';
  private s: GameState | null = null;
  onNext: () => void = () => {};
  onChange: (what: string) => void = () => {};
  onRename: () => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'prep';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }

  show(s: GameState): void {
    this.s = s;
    this.el.style.display = '';
    this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    this.render();
  }

  hide(): void { this.el.style.display = 'none'; }
  get visible(): boolean { return this.el.style.display !== 'none'; }

  private click(e: Event): void {
    const s = this.s;
    if (!s) return;
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab],[data-buy],[data-fire],[data-grade],[data-next],[data-rename]');
    if (!t) return;
    const d = t.dataset;
    if (d.tab) { this.tab = d.tab as Tab; this.render(); return; }
    if (d.next !== undefined) { this.onNext(); return; }
    if (d.rename !== undefined) { this.onRename(); return; }
    let changed = '';
    if (d.buy && buy(s, d.buy)) changed = d.buy;
    if (d.fire && fire(s, Number(d.fire))) changed = 'fire';
    if (d.grade) { const [id, g] = d.grade.split(':').map(Number); if (regrade(s, id, g as Grade)) changed = 'grade'; }
    if (changed) { this.onChange(changed); this.render(); }
  }

  render(): void {
    const s = this.s!;
    const all = offers(s);
    const list = all.filter((o) => o.tab === this.tab);
    const rec = recommend(s, this.tab, list);
    let body: string;
    if (this.tab === 'staff') body = staffCards(s, list, rec?.id ?? null);
    else {
      const sorted = rec ? [rec, ...list.filter((o) => o !== rec)] : list;
      body = sorted.map((o) => offerCard(o, o === rec)).join('') || '<div class="empty">모두 갖췄어요!</div>';
    }
    const next = Math.min(TIER_MICHELIN, s.tier + 1);
    const nt = TIERS[next];
    const r = ratingShown(s);
    const rev = avgRevenue3(s);
    const done = s.tier >= TIER_MICHELIN;
    const need: string[] = [];
    if (!done) {
      if (r < nt.rating) need.push(`별점 ${(nt.rating - r).toFixed(1)}`);
      if (rev < nt.revenue3) need.push(`3일 평균 매출 ${fmtMoney(nt.revenue3 - rev)}원`);
      if (nt.needVip && !s.vipOk) need.push('귀빈 인정');
    }
    const promoNow = s.promos.length ? `<div class="promo-now">홍보 중: ${s.promos.map((p) => `${{ flyer: '전단지', blog: '블로그', google: '구글', youtube: '유튜브', tv: 'TV', vip: '귀빈' }[p.id]} ${p.days}일`).join(' · ')}</div>` : '';
    this.el.innerHTML = `
      <div class="prep-head">
        <div class="ph-row"><b>${s.day}일차 준비</b><span class="shopname">${esc(s.shopName)}</span>
          <button class="chipbtn tap" type="button" data-rename>이름 바꾸기</button><span class="money ${s.money < 0 ? 'neg' : ''}">${fmtMoney(s.money)}원</span></div>
        ${done ? '<div class="tgoal">미슐랭 달성! 무한 영업 중</div>' : `
        <div class="tgoal">다음 티어 <b>${nt.name}</b>${need.length ? ` · 남은 조건: ${need.join(', ')}` : ' · 조건 충족! 내일 정산 때 승급'}</div>
        <div class="bars">
          <div class="pbar"><span>별점 ${r.toFixed(1)} / ${nt.rating.toFixed(1)}</span><i style="width:${Math.min(100, (r / nt.rating) * 100).toFixed(0)}%"></i></div>
          <div class="pbar"><span>매출 ${fmtMoney(rev)} / ${fmtMoney(nt.revenue3)}</span><i style="width:${Math.min(100, (rev / nt.revenue3) * 100).toFixed(0)}%"></i></div>
        </div>`}
        ${s.money < 0 ? '<div class="warn">돈이 마이너스예요. 오늘은 구매가 막혀요.</div>' : ''}
        ${promoNow}
      </div>
      <div class="tabs">${TABS.map(([k, n]) => `<button class="tab tap${k === this.tab ? ' on' : ''}" type="button" data-tab="${k}">${n}</button>`).join('')}</div>
      <div class="plist">${body}</div>
      <button class="btn main big tap" type="button" data-next>다음 영업하기</button>`;
  }
}
