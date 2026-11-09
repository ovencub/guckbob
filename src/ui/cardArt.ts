// 공유 카드용 2D 고양이 일러스트 (3D 모델과 같은 팔레트·얼굴)
const FUR_COLS = ['#F4B05A', '#A9ABB6', '#FFF8EE', '#3B3638', '#F6E1C3', '#3B3638'];
const INK = '#2B2A33';

export function drawCardCat(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, fur: number, chef: boolean): void {
  const r = 110 * s;
  const col = FUR_COLS[fur % FUR_COLS.length];
  x.save();
  x.lineWidth = 9 * s; x.strokeStyle = INK; x.lineJoin = 'round';
  // 꼬리
  x.beginPath(); x.moveTo(cx + r * 0.7, cy + r * 0.5); x.quadraticCurveTo(cx + r * 1.45, cy + r * 0.3, cx + r * 1.1, cy - r * 0.35);
  x.lineWidth = 26 * s; x.stroke(); x.lineWidth = 14 * s; x.strokeStyle = col; x.stroke();
  x.strokeStyle = INK; x.lineWidth = 9 * s;
  // 귀
  for (const sx of [-1, 1]) {
    x.fillStyle = col; x.beginPath(); x.moveTo(cx + sx * r * 0.25, cy - r * 0.8); x.lineTo(cx + sx * r * 0.62, cy - r * 1.25); x.lineTo(cx + sx * r * 0.82, cy - r * 0.55); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#FFB3B8'; x.beginPath(); x.moveTo(cx + sx * r * 0.38, cy - r * 0.8); x.lineTo(cx + sx * r * 0.6, cy - r * 1.08); x.lineTo(cx + sx * r * 0.7, cy - r * 0.7); x.closePath(); x.fill();
  }
  // 몸
  x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  if (fur === 2) { x.fillStyle = '#F2A24F'; x.beginPath(); x.ellipse(cx - r * 0.45, cy - r * 0.45, r * 0.35, r * 0.25, 0.3, 0, 7); x.fill(); x.fillStyle = INK; x.beginPath(); x.ellipse(cx + r * 0.5, cy - r * 0.3, r * 0.3, r * 0.25, 0, 0, 7); x.fill(); }
  if (fur !== 1 && fur !== 5) { x.fillStyle = '#FFF8EE'; x.beginPath(); x.ellipse(cx, cy + r * 0.5, r * 0.55, r * 0.42, 0, 0, Math.PI * 2); x.fill(); }
  // 얼굴
  x.fillStyle = INK;
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(cx + sx * r * 0.38, cy - r * 0.18, r * 0.11, 0, 7); x.fill(); }
  x.fillStyle = '#FFF'; for (const sx of [-1, 1]) { x.beginPath(); x.arc(cx + sx * r * 0.38 + r * 0.04, cy - r * 0.22, r * 0.035, 0, 7); x.fill(); }
  x.fillStyle = '#FFB3B8'; for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(cx + sx * r * 0.62, cy + r * 0.08, r * 0.13, r * 0.07, 0, 0, 7); x.fill(); }
  x.fillStyle = '#FFF8EE'; x.beginPath(); x.ellipse(cx, cy + r * 0.1, r * 0.28, r * 0.17, 0, 0, 7); x.fill();
  x.fillStyle = '#FF8FA3'; x.beginPath(); x.arc(cx, cy + r * 0.02, r * 0.07, 0, 7); x.fill();
  x.lineWidth = 6 * s; x.beginPath(); x.arc(cx - r * 0.07, cy + r * 0.12, r * 0.07, 0, Math.PI); x.arc(cx + r * 0.07, cy + r * 0.12, r * 0.07, 0, Math.PI); x.stroke();
  if (chef) {
    x.lineWidth = 9 * s; x.fillStyle = '#FFFFFF';
    x.beginPath(); x.rect(cx - r * 0.4, cy - r * 1.25, r * 0.8, r * 0.35); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(cx, cy - r * 1.42, r * 0.55, r * 0.32, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#FFC93C'; x.font = `${60 * s}px Jua, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('★★★', cx, cy - r * 1.45);
  }
  x.restore();
}
