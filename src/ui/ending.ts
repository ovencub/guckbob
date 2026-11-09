// 미슐랭 엔딩 (GDD 13장): 약 6초 연출(탭하면 넘김) → 결과 페이지
import { LOOKS, SIM_DT } from '../data/balance';
import { SEAT_RULES } from '../data/layouts';
import { TIERS, TIER_MICHELIN } from '../data/tiers';
import { TIMING } from '../data/view';
import { placeStaff } from '../sim/staffAI';
import { blankCat, geoOf, newDayState, ratingShown } from '../sim/state';
import type { GameState } from '../sim/types';
import { esc } from './prep/cards';
import { fmtMoney } from './hud';
import { confetti } from './tier';
import { titleFor, type ResultCode } from './share';
import { drawCardCat } from './cardArt';

/** 연출용 장면: 직원 + 모든 좌석에 손님 (sim 은 돌리지 않는다) */
export function celebrationScene(s: GameState): void {
  const ds = newDayState(s);
  s.dayState = ds;
  placeStaff(s);
  const g = geoOf(s.stage);
  let k = 0;
  for (const t of g.tables) {
    for (const st of t.seats) {
      const c = blankCat(ds.nextId++, 'guest', st.x, st.z, st.ry);
      c.state = 'seated'; c.y = SEAT_RULES.seatY; c.py = c.y; c.fur = k % LOOKS.furKinds; c.scarf = (k * 3) % LOOKS.scarfKinds;
      ds.cats.push(c);
      k++;
    }
  }
  void SIM_DT;
}

export function playEnding(root: HTMLElement, onDone: () => void): void {
  const el = document.createElement('div');
  el.className = 'overlay ending tap';
  el.innerHTML = `<div class="end-box"><div class="end-stars">★★★</div><div class="end-title">미슐랭 달성!</div><div class="tu-tap">탭해서 넘기기</div></div>`;
  root.appendChild(el);
  confetti(el, 90);
  const again = window.setInterval(() => confetti(el, 40), 1500);
  let done = false;
  const close = () => { if (done) return; done = true; clearInterval(again); el.remove(); onDone(); };
  el.addEventListener('click', close);
  setTimeout(close, TIMING.endingSec * 1000);
}

export function fmtPlay(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}

export interface ResultActions { share(): void; endless(): void; restart(): void }

export function showResult(root: HTMLElement, s: GameState, challenge: ResultCode | null, act: ResultActions): HTMLElement {
  const days = s.michelinDay || s.day;
  const title = titleFor(days);
  const maxDay = Math.max(days, 1);
  const timeline = TIERS.map((t, i) => {
    const d = i === 0 ? 1 : s.tierDays[i];
    return `<div class="tl"><span>${t.name}</span><i style="width:${d ? Math.max(4, (d / maxDay) * 100) : 0}%"></i><b>${d ? `${d}일` : '–'}</b></div>`;
  }).join('');
  const diff = challenge ? days - challenge.d : 0;
  const vs = challenge ? `<div class="vs">${esc(challenge.n)}의 도전장(${challenge.d}일)보다 <b>${diff === 0 ? '같은 날!' : diff < 0 ? `${-diff}일 빠름` : `${diff}일 느림`}</b></div>` : '';
  const el = document.createElement('div');
  el.className = 'overlay result';
  el.innerHTML = `<div class="paper rpaper">
    <div class="r-shop">${esc(s.shopName)}</div>
    <div class="r-big">${days}일 만에 미슐랭!</div>
    <div class="r-title">${title.name}</div>
    <div class="r-time">실제 플레이 ${fmtPlay(s.playSec)}</div>
    ${vs}
    <div class="r-sub">성장 타임라인</div><div class="tls">${timeline}</div>
    <div class="r-sub">누적 기록</div>
    <div class="stats">
      <span>받은 손님 <b>${s.stats.guests.toLocaleString('ko-KR')}명</b></span><span>판매 그릇 <b>${s.stats.bowls.toLocaleString('ko-KR')}</b></span>
      <span>총매출 <b>${fmtMoney(s.stats.revenue)}원</b></span><span>최고 하루 <b>${fmtMoney(s.stats.bestDay)}원</b></span>
      <span>탄 국밥 <b>${s.stats.burnt}</b></span><span>화난 손님 <b>${s.stats.angry}명</b></span>
      <span>최종 별점 <b>★${ratingShown(s).toFixed(1)}</b></span><span>최종 티어 <b>${TIERS[Math.min(s.tier, TIER_MICHELIN)].name}</b></span>
    </div>
    <div class="r-sub">우리 직원</div><div class="faces"></div>
    <div class="btns col">
      <button class="btn main big tap" type="button" data-a="share">자랑하기</button>
      <div class="btns"><button class="btn ghost tap" type="button" data-a="endless">계속 영업하기</button><button class="btn ghost tap" type="button" data-a="restart">처음부터 다시</button></div>
    </div></div>`;
  root.appendChild(el);
  const faces = el.querySelector('.faces') as HTMLElement;
  for (const m of s.staff) {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 140;
    drawCardCat(c.getContext('2d') as CanvasRenderingContext2D, 60, 85, 0.36, m.fur, m.role === 'chef');
    const w = document.createElement('div');
    w.className = 'face';
    w.appendChild(c);
    const n = document.createElement('span');
    n.textContent = m.name;
    w.appendChild(n);
    faces.appendChild(w);
  }
  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (a === 'share') act.share();
    if (a === 'endless') { el.remove(); act.endless(); }
    if (a === 'restart') { el.remove(); act.restart(); }
  });
  return el;
}
