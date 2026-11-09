// 직교 카메라 (피치 46°, 요 10°). 가게 경계 8점을 카메라 공간으로 투영해 맞춘다 (ART.md 2장).
// 탭 대상 44px 를 지키는 최소 배율보다 작아지면 화면에 다 넣지 않고 드래그 이동을 허용한다. 핀치 0.8~1.6배.
import * as THREE from 'three';
import { CAMERA } from '../data/view';

export class ShopCamera {
  readonly cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 160);
  private bounds: THREE.Vector3[] = [];
  private base = { cx: 0, cy: 0, W: 10, H: 10 };
  private panRange = { x0: 0, x1: 0, y0: 0, y1: 0 };
  zoom = 1;
  panX = 0;
  panY = 0;
  private h = 1;

  constructor() {
    const target = new THREE.Vector3(0, 0, 1);
    const yaw = THREE.MathUtils.degToRad(CAMERA.yawDeg);
    const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
    const d = CAMERA.dist;
    this.cam.position.set(target.x + d * Math.sin(yaw) * Math.cos(pitch), target.y + d * Math.sin(pitch), target.z + d * Math.cos(yaw) * Math.cos(pitch));
    this.cam.lookAt(target);
    this.cam.updateMatrixWorld();
  }

  setBounds(x0: number, x1: number, z0: number, z1: number): void {
    this.bounds = [];
    for (const x of [x0, x1]) for (const y of [0, CAMERA.boundsTop]) for (const z of [z0, z1]) this.bounds.push(new THREE.Vector3(x, y, z));
  }

  /** 화면 크기에 맞춘다. 반환: 다 들어갔는가 */
  fit(w: number, h: number): boolean {
    this.h = h;
    this.cam.updateMatrixWorld();
    const inv = this.cam.matrixWorldInverse;
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    const v = new THREE.Vector3();
    for (const p of this.bounds) {
      v.copy(p).applyMatrix4(inv);
      a = Math.min(a, v.x); b = Math.max(b, v.x); c = Math.min(c, v.y); d = Math.max(d, v.y);
    }
    const asp = w / h;
    const f = 1 - CAMERA.topMargin - CAMERA.botMargin;
    let H = Math.max((d - c) / f, ((b - a) / asp) * (1 - CAMERA.sideCrop * 2));
    const maxH = h / CAMERA.minPxPerTile;
    const fits = H <= maxH;
    if (!fits) H = maxH;
    const W = H * asp;
    let cy = (c + d) / 2 - (CAMERA.botMargin * H + (f * H) / 2) + H / 2;
    if (!fits) cy = d + CAMERA.topMargin * H - H / 2; // 주방(화면 위쪽)부터 보이게
    this.base = { cx: (a + b) / 2, cy, W, H };
    const spareX = Math.max(0, (b - a) - W) / 2;
    const below = Math.max(0, (cy - H / 2 + CAMERA.botMargin * H) - c);
    this.panRange = { x0: -spareX, x1: spareX, y0: -below, y1: 0 };
    this.panX = Math.max(this.panRange.x0, Math.min(this.panRange.x1, this.panX));
    this.panY = Math.max(this.panRange.y0, Math.min(this.panRange.y1, this.panY));
    this.apply();
    return fits;
  }

  get pxPerTile(): number { return (this.h * this.zoom) / this.base.H; }
  get canPan(): boolean { return this.panRange.y0 < 0 || this.panRange.x1 > 0 || this.zoom > 1; }

  pan(dxPx: number, dyPx: number): void {
    const k = this.base.H / this.zoom / this.h;
    this.panX -= dxPx * k;
    this.panY += dyPx * k;
    this.apply();
  }

  setZoom(z: number): void {
    this.zoom = Math.max(CAMERA.zoomMin, Math.min(CAMERA.zoomMax, z));
    this.apply();
  }

  resetView(): void { this.zoom = 1; this.panX = 0; this.panY = 0; this.apply(); }

  private apply(): void {
    const { cx, cy, W, H } = this.base;
    const z = this.zoom;
    const ex = Math.max(0, (W - W / z) / 2);
    const ey = Math.max(0, (H - H / z) / 2);
    this.panX = Math.max(this.panRange.x0 - ex, Math.min(this.panRange.x1 + ex, this.panX));
    this.panY = Math.max(this.panRange.y0 - ey, Math.min(this.panRange.y1 + ey, this.panY));
    const x = cx + this.panX;
    const y = cy + this.panY;
    this.cam.left = x - W / z / 2; this.cam.right = x + W / z / 2;
    this.cam.bottom = y - H / z / 2; this.cam.top = y + H / z / 2;
    this.cam.updateProjectionMatrix();
  }
}
