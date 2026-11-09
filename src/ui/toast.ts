// 짧은 알림 (같은 문구는 겹쳐 띄우지 않는다)
import { TIMING } from '../data/view';

export class Toasts {
  private el: HTMLDivElement;
  private last = '';
  private lastT = 0;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'toasts';
    root.appendChild(this.el);
  }

  show(msg: string, kind: 'warn' | 'info' | 'good' = 'warn'): void {
    const now = performance.now();
    if (msg === this.last && now - this.lastT < TIMING.toastSec * 1000) return;
    this.last = msg; this.lastT = now;
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = msg;
    this.el.appendChild(d);
    setTimeout(() => d.remove(), TIMING.toastSec * 1000);
    while (this.el.children.length > 3) this.el.firstChild?.remove();
  }

  /** 화면 가운데 큰 글자 ("영업 시작!", "마감!") */
  banner(text: string, sec: number): void {
    const d = document.createElement('div');
    d.className = 'banner';
    d.textContent = text;
    this.el.parentElement?.appendChild(d);
    setTimeout(() => d.remove(), sec * 1000);
  }
}
