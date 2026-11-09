// 화구 메뉴 선택: 빈 화구를 누르면 위로 원형 버튼이 펼쳐진다 (0.12초). 버튼마다 "아직 안 만든 그 메뉴 주문 수" 배지
import { MENUS, type MenuId } from '../data/menus';
import { TIMING } from '../data/view';
import { drawDish } from '../render/canvas2d';
import { TIERS } from '../data/tiers';

export class BurnerMenu {
  private el: HTMLDivElement;
  burner = -1;
  onPick: (burner: number, menu: MenuId) => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'bmenu';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open(): boolean { return this.burner >= 0; }

  show(burner: number, x: number, y: number, unlocked: Record<MenuId, boolean>, badges: Record<MenuId, number>, tier: number): void {
    this.burner = burner;
    this.el.innerHTML = '';
    const list = MENUS.filter((m) => unlocked[m.id] || m.unlockCost > 0);
    list.forEach((m, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pk tap${unlocked[m.id] ? '' : ' locked'}`;
      b.setAttribute('aria-label', unlocked[m.id] ? `${m.name} 조리` : `${m.name} 잠김`);
      const c = document.createElement('canvas');
      c.width = 108; c.height = 108;
      drawDish(c.getContext('2d') as CanvasRenderingContext2D, m.id, 54, 54, 88);
      b.appendChild(c);
      const cap = document.createElement('span');
      cap.className = 'pk-cap';
      cap.textContent = m.short;
      b.appendChild(cap);
      if (unlocked[m.id] && badges[m.id] > 0) {
        const bd = document.createElement('span');
        bd.className = 'pk-badge';
        bd.textContent = String(badges[m.id]);
        b.appendChild(bd);
      }
      if (!unlocked[m.id]) {
        const lk = document.createElement('span');
        lk.className = 'lk';
        lk.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="#FFF"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="#FFF" stroke-width="2.4"/></svg>';
        b.appendChild(lk);
        b.title = m.needTier > tier ? `${TIERS[m.needTier].name} 이상` : '정비 시간에 메뉴 개발';
      }
      b.style.transitionDelay = `${i * 0.02}s`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!unlocked[m.id]) return;
        const id = this.burner;
        this.hide();
        this.onPick(id, m.id);
      });
      this.el.appendChild(b);
    });
    const w = list.length * 70;
    const parent = this.el.parentElement as HTMLElement;
    const pw = parent.clientWidth;
    const left = Math.max(8, Math.min(pw - w - 8, x - w / 2));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${Math.max(8, y - 120)}px`;
    this.el.style.display = 'flex';
    this.el.style.transition = `transform ${TIMING.popupSec}s ease-out, opacity ${TIMING.popupSec}s`;
    this.el.style.transform = 'scale(0.4)';
    this.el.style.opacity = '0';
    requestAnimationFrame(() => { this.el.style.transform = 'scale(1)'; this.el.style.opacity = '1'; });
  }

  hide(): void {
    this.burner = -1;
    this.el.style.display = 'none';
  }
}
