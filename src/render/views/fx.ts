// 연출: 날아가는 국밥(포물선 0.2초), 숫자 팝업, 흰 연기 뿅, 김·탄 연기 (GDD 15장)
import * as THREE from 'three';
import { TIMING } from '../../data/view';
import { poofDraw, textPop } from '../canvas2d';
import { makeBowl, setBowl, type BowlKind, type BowlModel } from '../models/bowl';
import { cSprite, type CSprite } from '../sprites';

interface Fly { b: BowlModel; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; active: boolean }
interface Pop { s: CSprite; t: number; dur: number; rise: number; y0: number; active: boolean }
interface Poof { s: THREE.Sprite; t: number; active: boolean }
interface Puff { s: THREE.Sprite; life: number; dark: boolean }

const POOF_FRAMES = 6;

export class FxView {
  private flies: Fly[] = [];
  private pops: Pop[] = [];
  private poofs: Poof[] = [];
  private puffs: Puff[] = [];
  private poofMats: THREE.SpriteMaterial[] = [];
  private pi = 0;
  constructor(private root: THREE.Object3D) {
    for (let k = 0; k < POOF_FRAMES; k++) {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      poofDraw(c.getContext('2d') as CanvasRenderingContext2D, 160, k / (POOF_FRAMES - 1));
      this.poofMats.push(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false }));
    }
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const steamTex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 46; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false; sp.renderOrder = 5; root.add(sp);
      this.puffs.push({ s: sp, life: 0, dark: false });
    }
  }

  fly(from: THREE.Vector3, to: THREE.Vector3, kind: BowlKind, dur = TIMING.flySec, arc = 0.9, scale = 1.0): void {
    let f = this.flies.find((x) => !x.active);
    if (!f) {
      f = { b: makeBowl('sundae', this.root, undefined, scale), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur, arc, active: false };
      this.flies.push(f);
    }
    f.from.copy(from); f.to.copy(to); f.t = 0; f.dur = dur; f.arc = arc; f.active = true;
    f.b.scale.setScalar(scale);
    setBowl(f.b, kind);
    f.b.visible = true;
    f.b.position.copy(from);
  }

  pop(text: string, color: string, pos: THREE.Vector3, size = 56, dur: number = TIMING.popTextSec): void {
    let p = this.pops.find((x) => !x.active);
    if (!p) {
      const s = cSprite(360, 96, 0.5, this.root, 30);
      p = { s, t: 0, dur, rise: 0.9, y0: 0, active: false };
      this.pops.push(p);
    }
    p.s.draw(`${text}|${color}|${size}`, (x) => textPop(x, text, 180, 50, size, color));
    p.s.sp.position.copy(pos);
    p.y0 = pos.y; p.t = 0; p.dur = dur; p.active = true; p.s.sp.visible = true;
  }

  poof(x: number, y: number, z: number): void {
    let p = this.poofs.find((q) => !q.active);
    if (!p) {
      const s = new THREE.Sprite(this.poofMats[0]);
      s.renderOrder = 19; s.scale.set(0.8, 0.8, 1); this.root.add(s);
      p = { s, t: 0, active: false };
      this.poofs.push(p);
    }
    p.s.position.set(x, y + 0.5, z); p.t = 0; p.active = true; p.s.visible = true;
  }

  puff(x: number, y: number, z: number, dark = false): void {
    const p = this.puffs[this.pi++ % this.puffs.length];
    p.s.position.set(x + (Math.random() - 0.5) * 0.12, y, z + (Math.random() - 0.5) * 0.12);
    p.life = 1; p.dark = dark; p.s.visible = true;
    (p.s.material as THREE.SpriteMaterial).color.setHex(dark ? 0x3a3640 : 0xffffff);
  }

  update(dt: number): void {
    for (const f of this.flies) {
      if (!f.active) continue;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.b.position.lerpVectors(f.from, f.to, k);
      f.b.position.y += Math.sin(k * Math.PI) * f.arc;
      if (k >= 1) { f.active = false; f.b.visible = false; }
    }
    for (const p of this.pops) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.dur;
      p.s.sp.position.y = p.y0 + k * p.rise * 0.6;
      (p.s.sp.material as THREE.SpriteMaterial).opacity = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      if (k >= 1) { p.active = false; p.s.sp.visible = false; (p.s.sp.material as THREE.SpriteMaterial).opacity = 1; }
    }
    for (const p of this.poofs) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / TIMING.poofSec;
      p.s.material = this.poofMats[Math.min(POOF_FRAMES - 1, Math.floor(k * POOF_FRAMES))];
      if (k >= 1) { p.active = false; p.s.visible = false; }
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.9;
      p.s.position.y += dt * (p.dark ? 0.8 : 0.55);
      const sc = (p.dark ? 0.2 : 0.12) + (1 - p.life) * (p.dark ? 0.35 : 0.22);
      p.s.scale.set(sc, sc, 1);
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life) * (p.dark ? 0.85 : 0.75);
      if (p.life <= 0) p.s.visible = false;
    }
  }

  clear(): void {
    for (const f of this.flies) { f.active = false; f.b.visible = false; }
    for (const p of this.pops) { p.active = false; p.s.sp.visible = false; }
    for (const p of this.poofs) { p.active = false; p.s.visible = false; }
  }
}
