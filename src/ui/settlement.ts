// 정산 영수증 (GDD 12장): 위에서 내려오고 줄당 0.15초로 찍힌다. 탭하면 한 번에 전부. 3초 이내.
import { ROLE_NAMES, GRADE_NAMES } from '../data/staff';
import { TIERS, TIER_MICHELIN } from '../data/tiers';
import { TIMING } from '../data/view';
import { avgRevenue3 } from '../sim/economy';
import type { DayReport, GameState } from '../sim/types';
import { fmtMoney } from './hud';

const won = (n: number) => `${n < 0 ? '−' : ''}${fmtMoney(Math.abs(n))}원`;

export class Settlement {
  private el: HTMLDivElement;
  private timers: number[] = [];
  onConfirm: () => void = () => {};
  onShare: () => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'overlay settle';
    this.el.style.display = 'none';
    root.appendChild(this.el);
  }

  show(s: GameState, r: DayReport): void {
    const lines: string[] = [];
    lines.push(`<div class="rl"><span>총매출 <small>판매 ${r.sold}그릇 · 맛 프리미엄 포함</small></span><b class="plus">+${fmtMoney(r.revenue)}</b></div>`);
    lines.push(`<div class="rl"><span>재료비</span><b>−${fmtMoney(r.ingredients)}</b></div>`);
    for (const w of r.wages) lines.push(`<div class="rl"><span>${w.name} <small>${ROLE_NAMES[w.role]} ${GRADE_NAMES[w.grade]}</small></span><b>−${fmtMoney(w.wage)}</b></div>`);
    lines.push(`<div class="rl"><span>임대료</span><b>−${fmtMoney(r.rent)}</b></div>`);
    lines.push(`<div class="rl"><span>공과금</span><b>−${fmtMoney(r.utility)}</b></div>`);
    if (r.promo) lines.push(`<div class="rl"><span>홍보비</span><b>−${fmtMoney(r.promo)}</b></div>`);
    lines.push(`<div class="rl total"><span>순수익</span><b class="${r.net < 0 ? 'neg' : 'plus'}">${r.net < 0 ? '' : '+'}${won(r.net)}</b></div>`);
    const dr = Math.round(r.ratingAfter * 10) / 10 - Math.round(r.ratingBefore * 10) / 10;
    const arrow = dr > 0.001 ? `<i class="up">▲${dr.toFixed(1)}</i>` : dr < -0.001 ? `<i class="down">▼${Math.abs(dr).toFixed(1)}</i>` : '';
    const nextT = Math.min(TIER_MICHELIN, s.tier + 1);
    const nt = TIERS[nextT];
    const stats = `
      <div class="stats">
        <span>받은 손님 <b>${r.teams}팀 ${r.guests}명</b></span><span>놓친 손님 <b>${r.missed}명</b></span>
        <span>화난 손님 <b>${r.angry}명</b></span><span>탄 국밥 <b>${r.burnt}그릇</b></span>
        <span>오늘 리뷰 <b>★${r.reviewAvg.toFixed(1)}</b></span><span>가게 별점 <b>★${r.ratingAfter.toFixed(1)}</b>${arrow}</span>
      </div>
      ${s.tier < TIER_MICHELIN ? `<div class="tprog">다음: <b>${nt.name}</b> · 별점 ${r.ratingAfter.toFixed(1)}/${nt.rating} · 3일 평균 ${fmtMoney(avgRevenue3(s))}/${fmtMoney(nt.revenue3)}${nt.needVip ? ` · 귀빈 인정 ${s.vipOk ? '✓' : '✗'}` : ''}</div>` : ''}
      ${r.vip !== 'none' ? `<div class="tprog vip">${r.vip === 'pass' ? '귀빈 인정! ★' : '귀빈이 만족하지 못했어요. 다시 부를 수 있어요.'}</div>` : ''}`;
    this.el.innerHTML = `
      <div class="paper">
        <div class="ph">${r.day}일차 영수증</div>
        <div class="lines">${lines.join('')}</div>
        ${stats}
        <div class="btns">
          <button class="btn ghost tap" type="button" data-a="share">자랑하기</button>
          <button class="btn main tap" type="button" data-a="ok">확인</button>
        </div>
      </div>`;
    this.el.style.display = '';
    const rows = [...this.el.querySelectorAll<HTMLElement>('.rl, .stats, .tprog')];
    const step = Math.min(TIMING.receiptLineSec, TIMING.receiptMaxSec / Math.max(1, rows.length + 2));
    rows.forEach((row, i) => {
      row.classList.add('hide');
      this.timers.push(window.setTimeout(() => row.classList.remove('hide'), (TIMING.screenSec + i * step) * 1000));
    });
    const paper = this.el.querySelector('.paper') as HTMLElement;
    paper.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'ok') { this.hide(); this.onConfirm(); return; }
      if (a === 'share') { this.onShare(); return; }
      this.revealAll();
    });
  }

  revealAll(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.el.querySelectorAll('.hide').forEach((n) => n.classList.remove('hide'));
  }

  hide(): void { this.revealAll(); this.el.style.display = 'none'; }
  get visible(): boolean { return this.el.style.display !== 'none'; }
}
