// 티어 업 축하 (2초, 탭하면 넘김) + 색종이
import { TIERS } from '../data/tiers';
import { TIMING } from '../data/view';

export function confetti(root: HTMLElement, n = 60): void {
  const box = document.createElement('div');
  box.className = 'confetti';
  const cols = ['#E2533B', '#F7C948', '#5CC46B', '#4C8DD9', '#B57EDC', '#F28C38'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = cols[i % cols.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  root.appendChild(box);
  setTimeout(() => box.remove(), 3000);
}

export function showTierUp(root: HTMLElement, tier: number, done: () => void): void {
  const el = document.createElement('div');
  el.className = 'overlay tierup tap';
  el.innerHTML = `<div class="tu-box"><div class="tu-small">축하해요! 가게가 성장했어요</div><div class="tu-name">${TIERS[tier].name}</div>
    ${TIERS[tier].unlocks ? `<div class="tu-un">새로 열림: ${TIERS[tier].unlocks}</div>` : ''}<div class="tu-tap">탭해서 넘기기</div></div>`;
  root.appendChild(el);
  confetti(el);
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.remove(); done(); };
  el.addEventListener('click', close);
  setTimeout(close, TIMING.tierUpSec * 1000);
}
