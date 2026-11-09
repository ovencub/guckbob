// 2D 그리기: 메뉴 아이콘, 말풍선, 게이지, 동전, 외곽 글자 (design/style-preview.html 이식)
import type { MenuId } from '../data/menus';
import { INK } from './toon';

export type DishKind = MenuId | 'dirty';
export const FONT = 'Jua, "Noto Sans KR", system-ui, sans-serif';
type Ctx = CanvasRenderingContext2D;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawDish(ctx: Ctx, type: DishKind, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.055);
  if (type === 'suyuk') {
    ctx.fillStyle = '#FFFDF8'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.48, s * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EFE6D6'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.36, s * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = -0.5 + i * 0.33;
      const x = cx - s * 0.2 + i * s * 0.13;
      const y = cy + s * 0.06;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#F2B9A2'; rr(ctx, -s * 0.1, -s * 0.16, s * 0.2, s * 0.3, s * 0.05); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF4EA'; rr(ctx, -s * 0.1, -s * 0.16, s * 0.2, s * 0.07, s * 0.035); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#7CC45A'; ctx.beginPath(); ctx.ellipse(cx + s * 0.27, cy + s * 0.2, s * 0.07, s * 0.04, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    const spicy = type === 'spicy';
    const dirty = type === 'dirty';
    ctx.fillStyle = '#5A3A2E';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.47, cy - s * 0.02); ctx.lineTo(cx + s * 0.47, cy - s * 0.02);
    ctx.quadraticCurveTo(cx + s * 0.43, cy + s * 0.36, cx + s * 0.2, cy + s * 0.38); ctx.lineTo(cx - s * 0.2, cy + s * 0.38);
    ctx.quadraticCurveTo(cx - s * 0.43, cy + s * 0.36, cx - s * 0.47, cy - s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(cx - s * 0.33, cy + s * 0.08);
    ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.24, cx - s * 0.18, cy + s * 0.29); ctx.stroke();
    ctx.strokeStyle = INK; ctx.fillStyle = '#73493A'; ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.02, s * 0.5, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dirty ? '#8C6B4C' : spicy ? '#E5533A' : '#F2E6CF';
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.025, s * 0.4, s * 0.115, 0, 0, Math.PI * 2); ctx.fill();
    if (!dirty) {
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      for (const [dx, dy] of [[-0.18, -0.03], [0.02, 0.0], [0.2, -0.04]]) {
        ctx.fillStyle = '#5E3B4A'; ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, s * 0.075, s * 0.04, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#D9B8C2'; ctx.beginPath(); ctx.arc(cx + dx * s - s * 0.02, cy + dy * s - s * 0.005, s * 0.012, 0, 7);
        ctx.arc(cx + dx * s + s * 0.025, cy + dy * s + s * 0.008, s * 0.01, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#7CC45A';
      for (const [dx, dy] of [[-0.08, -0.07], [0.12, -0.06], [0.3, -0.02], [-0.3, -0.01]]) ctx.fillRect(cx + dx * s, cy + dy * s, s * 0.05, s * 0.03);
      if (spicy) {
        ctx.fillStyle = '#9E2A1C';
        for (const [dx, dy] of [[-0.25, -0.05], [0.1, 0.03], [0.28, -0.07], [-0.05, 0.04]]) { ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, s * 0.018, 0, 7); ctx.fill(); }
      }
      ctx.strokeStyle = spicy ? 'rgba(229,83,58,.75)' : 'rgba(43,42,51,.35)'; ctx.lineWidth = Math.max(2, s * 0.04);
      for (const dx of [-0.14, 0.06, 0.24]) {
        ctx.beginPath(); ctx.moveTo(cx + dx * s, cy - s * 0.2);
        ctx.bezierCurveTo(cx + (dx - 0.07) * s, cy - s * 0.28, cx + (dx + 0.07) * s, cy - s * 0.34, cx + dx * s, cy - s * 0.44); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export const gaugeColor = (p: number): string => (p > 0.5 ? '#5CC46B' : p > 0.2 ? '#F7C948' : '#E2533B');

export function bubble(ctx: Ctx, x: number, y: number, w: number, h: number, tail: boolean): void {
  ctx.save(); ctx.lineJoin = 'round'; ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = INK; ctx.lineWidth = 7;
  rr(ctx, x, y, w, h, Math.min(30, h / 2.4)); ctx.fill(); ctx.stroke();
  if (tail) {
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 16, y + h - 3); ctx.lineTo(x + w / 2, y + h + 22); ctx.lineTo(x + w / 2 + 16, y + h - 3); ctx.fill(); ctx.stroke();
    ctx.fillRect(x + w / 2 - 13, y + h - 8, 26, 9);
  }
  ctx.restore();
}

export function gauge(ctx: Ctx, x: number, y: number, w: number, p: number): void {
  ctx.save(); ctx.fillStyle = '#EEE6D6'; ctx.strokeStyle = INK; ctx.lineWidth = 5; rr(ctx, x, y, w, 16, 8); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, 16, 8); ctx.clip(); ctx.fillStyle = gaugeColor(p); ctx.fillRect(x, y, w * Math.max(0, p), 16); ctx.restore();
  rr(ctx, x, y, w, 16, 8); ctx.stroke(); ctx.restore();
}

export function coin(ctx: Ctx, cx: number, cy: number, r: number, grey = false): void {
  ctx.save(); ctx.fillStyle = grey ? '#C9C4BA' : '#FFD34D'; ctx.strokeStyle = INK; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, 7); ctx.fill();
  ctx.fillStyle = INK; ctx.font = `${Math.round(r * 1.15)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('₩', cx, cy + r * 0.06); ctx.restore();
}

export function textPop(ctx: Ctx, str: string, cx: number, cy: number, size: number, fill: string): void {
  ctx.save(); ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.26; ctx.strokeStyle = INK; ctx.strokeText(str, cx, cy); ctx.fillStyle = fill; ctx.fillText(str, cx, cy); ctx.restore();
}

export function poofDraw(ctx: Ctx, w: number, k: number): void {
  const c = w / 2;
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = INK; ctx.lineWidth = 6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 20 + k * 40;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 18 * (1 - k) + 6, 0, 7); ctx.fill(); ctx.stroke();
  }
}
