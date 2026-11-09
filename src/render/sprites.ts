// 캔버스 스프라이트: 3D 위에 항상 그려지는 2D 신호 (depthTest:false)
import * as THREE from 'three';

export interface CSprite {
  sp: THREE.Sprite;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  base: number;
  w: number;
  h: number;
  key: string;
  /** 같은 key 면 다시 그리지 않는다 (매 프레임 캔버스 업로드 방지) */
  draw(key: string, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void;
}

export function cSprite(w: number, h: number, worldH: number, parent: THREE.Object3D, order = 20): CSprite {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set((worldH * w) / h, worldH, 1);
  sp.renderOrder = order;
  parent.add(sp);
  const api: CSprite = {
    sp, ctx, canvas, tex, base: worldH, w, h, key: '',
    draw(key, fn) {
      if (key === api.key) return;
      api.key = key;
      ctx.clearRect(0, 0, w, h);
      fn(ctx, w, h);
      tex.needsUpdate = true;
    },
  };
  return api;
}

export function setSpriteScale(s: CSprite, k: number): void {
  s.sp.scale.set(((s.base * s.w) / s.h) * k, s.base * k, 1);
}

export function disposeSprite(s: CSprite): void {
  s.sp.removeFromParent();
  s.tex.dispose();
  (s.sp.material as THREE.SpriteMaterial).dispose();
}
