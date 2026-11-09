// 결과 공유: ?r= 링크(JSON → base64url, 받는 쪽 검증), 결과 카드 1080×1350, 오늘 카드, Web Share → 저장 안내 + 링크 복사
import { SHARE } from '../data/share';
import { TITLES } from '../data/tiers';
import { drawCardCat } from './cardArt';

export interface ResultCode { v: number; n: string; d: number; m: number; s: number; c: number; t: number }

export function titleFor(days: number): { code: number; name: string } {
  const i = TITLES.findIndex((t) => days <= t.maxDays);
  return { code: i, name: TITLES[i].name };
}

function b64urlEncode(txt: string): string {
  const bytes = new TextEncoder().encode(txt);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length > 400) throw new Error('bad');
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeResult(r: Omit<ResultCode, 'v'>): string {
  return b64urlEncode(JSON.stringify({ v: SHARE.version, ...r }));
}

const isInt = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/** 받은 링크 값 검증. 하나라도 이상하면 null (텍스트로만 표시) */
export function decodeResult(s: string | null): ResultCode | null {
  if (!s) return null;
  try {
    const o = JSON.parse(b64urlDecode(s)) as Record<string, unknown>;
    if (o.v !== SHARE.version) return null;
    if (typeof o.n !== 'string' || [...o.n].length === 0 || [...o.n].length > SHARE.nameMax || /[\u0000-\u001f<>]/.test(o.n)) return null;
    if (!isInt(o.d, 1, SHARE.daysMax) || !isInt(o.m, 0, SHARE.minutesMax) || !isInt(o.c, 0, SHARE.guestsMax) || !isInt(o.t, 0, TITLES.length - 1)) return null;
    if (typeof o.s !== 'number' || !(o.s >= 0 && o.s <= 5)) return null;
    return { v: 1, n: o.n, d: o.d as number, m: o.m as number, s: Math.round((o.s as number) * 10) / 10, c: o.c as number, t: o.t as number };
  } catch { return null; }
}

export const resultUrl = (code: string): string => `${SHARE.url}?r=${code}`;

function roundRect(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number): void {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}

function outlined(x: CanvasRenderingContext2D, t: string, cx: number, cy: number, size: number, fill: string, stroke = '#2B2A33'): void {
  x.font = `${size}px Jua, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = size * 0.22; x.strokeStyle = stroke; x.strokeText(t, cx, cy); x.fillStyle = fill; x.fillText(t, cx, cy);
}

export interface CardData { shop: string; big: string; title: string; lines: Array<[string, string]>; furs: number[] }

/** 공유 카드 이미지 (1080×1350) */
export function drawCard(d: CardData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SHARE.cardW; c.height = SHARE.cardH;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = '#F4E3C6'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 14; i++) for (let j = 0; j < 18; j++) { x.fillStyle = (i + j) % 2 ? '#EBD5AE' : '#F4E3C6'; x.fillRect(i * 80, j * 80, 80, 80); }
  x.fillStyle = '#FFFDF8'; x.strokeStyle = '#2B2A33'; x.lineWidth = 10;
  roundRect(x, 60, 60, 960, 1230, 60); x.fill(); x.stroke();
  outlined(x, d.shop, 540, 160, 72, '#E2533B');
  outlined(x, d.big, 540, 300, 104, '#FFD34D');
  x.fillStyle = '#2B2A33'; roundRect(x, 290, 380, 500, 90, 45); x.fill();
  x.fillStyle = '#FFF6E0'; x.font = '52px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(d.title, 540, 427);
  d.furs.slice(0, 3).forEach((f, i) => drawCardCat(x, 540 + (i - (Math.min(3, d.furs.length) - 1) / 2) * 260, 690, i === 1 ? 1.15 : 0.95, f, i === 1));
  d.lines.forEach(([k, v], i) => {
    const y = 930 + i * 78;
    x.fillStyle = '#5D6B74'; x.font = '44px Jua, sans-serif'; x.textAlign = 'left'; x.fillText(k, 150, y);
    x.fillStyle = '#2B2A33'; x.textAlign = 'right'; x.fillText(v, 930, y);
  });
  x.fillStyle = '#7B7468'; x.font = '36px Jua, sans-serif'; x.textAlign = 'center'; x.fillText('고양이 국밥집 · ovencub.github.io/guckbob', 540, 1240);
  return c;
}

/** Web Share(이미지+링크) → 안 되면 이미지 저장 + 링크 복사 */
export async function shareCard(canvas: HTMLCanvasElement, text: string, url: string, toast: (m: string) => void): Promise<void> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'guckbob.png', { type: 'image/png' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (file && nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text, url }); return; }
    if (nav.share) { await nav.share({ text, url }); }
  } catch { /* 취소 또는 실패 → 아래 대체 */ }
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'guckbob.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('이미지를 저장하고 링크를 복사했어요'); }
  catch { toast('이미지를 저장했어요. 링크: ' + url); }
}
