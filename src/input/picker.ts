// 입력: 투명 히트박스 레이캐스트로 탭 대상을 찾고, 8px 이상 움직이면 드래그(국밥 끌어 서빙 / 화면 이동)
import * as THREE from 'three';
import { INPUT } from '../data/view';
import type { Renderer } from '../render/renderer';

export interface Pick { kind: string; id: number; point: THREE.Vector3 }

export interface InputHandlers {
  tap(p: Pick | null, x: number, y: number): void;
  dragStart(p: Pick | null, x: number, y: number): boolean; // true = 이 드래그를 가져감 (국밥 끌기)
  dragMove(x: number, y: number, pick: Pick | null): void;
  dragEnd(pick: Pick | null, x: number, y: number): void;
  pan(dx: number, dy: number): void;
  pinch(scale: number): void;
}

export class Picker {
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragging: 'none' | 'item' | 'pan' = 'none';
  private startPick: Pick | null = null;
  private pinchD = 0;
  enabled = true;

  constructor(private r: Renderer, private hits: () => THREE.Object3D[], private h: InputHandlers) {
    const el = r.canvas;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); this.dragging = 'none'; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.h.pinch(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
  }

  pick(x: number, y: number): Pick | null {
    this.r.toNdc(x, y, this.ndc);
    this.ray.setFromCamera(this.ndc, this.r.camera.cam);
    const res = this.ray.intersectObjects(this.hits(), false);
    if (!res.length) return null;
    // 겹치면 카메라에 가까운 것. 단 같은 거리면 작은 대상(화구·배식대)을 우선
    const o = res[0].object;
    return { kind: o.userData.kind as string, id: o.userData.id as number, point: res[0].point };
  }

  private down(e: PointerEvent): void {
    if (!this.enabled) return;
    this.r.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragging = 'pan';
      return;
    }
    this.dragging = 'none';
    this.startPick = this.pick(e.clientX, e.clientY);
  }

  private move(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchD > 0) this.h.pinch(d / this.pinchD);
      this.pinchD = d;
      return;
    }
    if (this.dragging === 'none' && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > INPUT.tapSlopPx) {
      this.dragging = this.h.dragStart(this.startPick, p.sx, p.sy) ? 'item' : 'pan';
    }
    if (this.dragging === 'item') this.h.dragMove(e.clientX, e.clientY, this.pick(e.clientX, e.clientY));
    else if (this.dragging === 'pan') this.h.pan(dx, dy);
  }

  private up(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p || !this.enabled) return;
    if (this.dragging === 'item') this.h.dragEnd(this.pick(e.clientX, e.clientY), e.clientX, e.clientY);
    else if (this.dragging === 'none') this.h.tap(this.startPick, e.clientX, e.clientY);
    if (this.pointers.size === 0) this.dragging = 'none';
  }
}
