// 렌더러: three 장면·조명·카메라·루프. 시뮬레이션 상태는 views 가 읽어서 반영한다.
import * as THREE from 'three';
import { CAMERA, LIGHT } from '../data/view';
import { ShopCamera } from './camera';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new ShopCamera();
  private dpr = Math.min(window.devicePixelRatio || 1, CAMERA.maxDpr);
  private fpsAcc = 0;
  private fpsFrames = 0;
  private lowered = false;
  w = 1;
  h = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    // 레퍼런스(r128)와 같은 인상: 색 관리 끔 + 선형 출력 + 조명 × π (결정 로그)
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = false;
    this.scene.background = new THREE.Color(LIGHT.bg);
    this.scene.add(new THREE.AmbientLight(0xffffff, LIGHT.ambient * LIGHT.legacyScale));
    const sun = new THREE.DirectionalLight(0xffffff, LIGHT.sun * LIGHT.legacyScale);
    sun.position.set(LIGHT.sunPos[0], LIGHT.sunPos[1], LIGHT.sunPos[2]);
    this.scene.add(sun);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.fit(this.w, this.h);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera.cam);
  }

  /** 5초 평균 fps 가 낮으면 픽셀 비율 1로 (8단계) */
  trackFps(dt: number): void {
    if (this.lowered) return;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= CAMERA.fpsWindowSec) {
      const fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (fps < CAMERA.lowFpsThreshold && this.dpr > 1) {
        this.lowered = true;
        this.dpr = 1;
        this.renderer.setPixelRatio(1);
        this.resize();
      }
    }
  }

  get drawCalls(): number { return this.renderer.info.render.calls; }
  get pixelRatio(): number { return this.dpr; }

  /** 화면 좌표(px) → 정규화 장치 좌표 */
  toNdc(px: number, py: number, out: THREE.Vector2): THREE.Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return out.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  }

  /** 월드 좌표 → 화면 px (캔버스 기준) */
  toScreen(p: THREE.Vector3, out: { x: number; y: number }): { x: number; y: number } {
    const v = p.clone().project(this.camera.cam);
    out.x = (v.x * 0.5 + 0.5) * this.w;
    out.y = (-v.y * 0.5 + 0.5) * this.h;
    return out;
  }
}
