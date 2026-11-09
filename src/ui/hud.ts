// 상단 HUD + 하단 일시정지·팁 (ART.md 7장, GDD 16장). 상태는 매 프레임 update 로 넣고, 바뀐 값만 DOM 에 쓴다.
import { DAY } from '../data/balance';

const ICON_COIN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#FFD34D" stroke="#2B2A33" stroke-width="2.2"/><path d="M7.5 9l1.6 6 1.9-5 1.9 5 1.6-6M7 11.4h10" fill="none" stroke="#2B2A33" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.7 5.7 6.2.8-4.6 4.3 1.2 6.1L12 16.8l-5.5 2.9 1.2-6.1L3.1 9.3l6.2-.8z" fill="#FFC93C" stroke="#2B2A33" stroke-width="2" stroke-linejoin="round"/></svg>';
export const ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="#2B2A33"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="#2B2A33"/></svg>';
export const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="#2B2A33"/></svg>';
export const ICON_SOUND = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#2B2A33"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="#2B2A33" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#2B2A33"/><path d="M16 9l5 6M21 9l-5 6" stroke="#2B2A33" stroke-width="2.2" stroke-linecap="round"/></svg>';

export interface HudData {
  money: number; rating: number; tierName: string; day: number;
  progress: number; closed: boolean; clean: number; bowls: number; sink: number; sinkCap: number; queue: number;
  tip: string; paused: boolean; muted: boolean;
}

export const fmtMoney = (n: number): string => Math.round(n).toLocaleString('ko-KR');

export function clockText(progress: number): string {
  const m = Math.round(DAY.clockStartMin + (DAY.clockEndMin - DAY.clockStartMin) * Math.min(1, progress));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export class Hud {
  readonly el: HTMLElement;
  readonly moneyEl: HTMLElement;
  readonly starPill: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  onPause: () => void = () => {};
  onMute: () => void = () => {};

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-top">
        <div class="row">
          <span class="pill" data-k="moneyPill">${ICON_COIN}<span data-k="money">0</span></span>
          <span class="pill" data-k="starPill">${ICON_STAR}<span data-k="star">0.0</span></span>
          <span class="pill tier" data-k="tier">소상공인</span>
        </div>
        <div class="day" data-k="dayBox"><span data-k="day">1일차</span><span class="bar"><i data-k="bar"></i></span><span data-k="clock">11:00</span></div>
        <div class="chips">
          <span class="chip" data-k="bowlChip">그릇 <b data-k="clean">6</b>/<span data-k="bowls">6</span></span>
          <span class="chip" data-k="sinkChip">개수대 <b data-k="sink">0</b>/<span data-k="sinkCap">8</span></span>
          <span class="chip" data-k="queueChip">웨이팅 <b data-k="queue">0</b>팀</span>
        </div>
      </div>
      <div class="hud-bottom">
        <button class="round" type="button" data-k="pause" aria-label="일시정지">${ICON_PAUSE}</button>
        <div class="tip" data-k="tip">손님이 오면 테이블을 눌러 주문을 받으세요.</div>
        <button class="round" type="button" data-k="mute" aria-label="소리 끄기">${ICON_SOUND}</button>
      </div>`;
    root.appendChild(el);
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((n) => { this.els[n.dataset.k as string] = n; });
    this.el = el;
    this.moneyEl = this.els.moneyPill;
    this.starPill = this.els.starPill;
    this.els.pause.addEventListener('click', () => this.onPause());
    this.els.mute.addEventListener('click', () => this.onMute());
  }

  private set(k: string, v: string, html = false): void {
    if (this.last[k] === v) return;
    this.last[k] = v;
    if (html) this.els[k].innerHTML = v; else this.els[k].textContent = v;
  }

  update(d: HudData, shownMoney: number): void {
    this.set('money', fmtMoney(shownMoney));
    this.set('star', d.rating.toFixed(1));
    this.set('tier', d.tierName);
    this.set('day', `${d.day}일차`);
    this.set('clock', d.closed ? '마감' : clockText(d.progress));
    const w = `${(Math.min(1, d.progress) * 100).toFixed(1)}%`;
    if (this.last.bar !== w) { this.last.bar = w; this.els.bar.style.width = w; }
    this.els.dayBox.classList.toggle('closed', d.closed);
    this.set('clean', String(d.clean));
    this.set('bowls', String(d.bowls));
    this.set('sink', String(d.sink));
    this.set('sinkCap', String(d.sinkCap));
    this.set('queue', String(d.queue));
    this.els.bowlChip.classList.toggle('warn', d.clean === 0);
    this.els.sinkChip.classList.toggle('warn', d.sink >= d.sinkCap);
    this.set('tip', d.tip);
    this.set('pause', d.paused ? ICON_PLAY : ICON_PAUSE, true);
    this.els.pause.setAttribute('aria-label', d.paused ? '계속하기' : '일시정지');
    this.set('mute', d.muted ? ICON_MUTE : ICON_SOUND, true);
    this.els.mute.setAttribute('aria-label', d.muted ? '소리 켜기' : '소리 끄기');
  }

  show(on: boolean): void { this.el.style.display = on ? '' : 'none'; }
}
