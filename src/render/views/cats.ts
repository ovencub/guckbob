// 고양이 뷰: sim 의 Cat 을 읽어 3D 고양이에 반영 (보간 + 코드 트윈 애니메이션, ART.md 4장)
import * as THREE from 'three';
import { CAT_DIM } from '../../data/layouts';
import { SEAT_RULES } from '../../data/layouts';
import { TABLE } from '../../data/balance';
import { patienceLevel, patienceUsed } from '../../sim/customers';
import type { Cat, GameState, Team } from '../../sim/types';
import { textPop } from '../canvas2d';
import { FURS, SCARVES, makeCat, type CatModel, type CatRole } from '../models/cat';
import { setBowl } from '../models/bowl';

const EAT_LEAN = 0.1; // 식사 중 기울기 최대(rad), ART 8.4
const WALK_TAIL = 0.25; // 걷는 동안 꼬리 흔들기 비율

function sharedSprite(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(c);
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false });
}

let mats: Record<'nyam' | 'tak' | 'hmph' | 'heart', THREE.SpriteMaterial> | null = null;
function labelMats() {
  if (mats) return mats;
  mats = {
    nyam: sharedSprite(160, 80, (x) => textPop(x, '냠', 80, 42, 52, '#FFFFFF')),
    hmph: sharedSprite(160, 80, (x) => textPop(x, '흥!', 80, 42, 52, '#E2533B')),
    tak: sharedSprite(128, 96, (x) => {
      x.strokeStyle = '#2B2A33'; x.lineWidth = 7; x.lineCap = 'round';
      [[20, 70, 44, 48], [54, 80, 60, 46], [88, 72, 108, 52]].forEach((l) => { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); });
      textPop(x, '탁탁', 64, 22, 30, '#FFD34D');
    }),
    heart: sharedSprite(96, 96, (x) => {
      x.fillStyle = '#FF6B8A'; x.strokeStyle = '#2B2A33'; x.lineWidth = 6; x.beginPath();
      x.moveTo(48, 80); x.bezierCurveTo(10, 55, 10, 18, 34, 18); x.bezierCurveTo(44, 18, 48, 26, 48, 30);
      x.bezierCurveTo(48, 26, 52, 18, 62, 18); x.bezierCurveTo(86, 18, 86, 55, 48, 80); x.fill(); x.stroke();
    }),
  };
  return mats;
}

interface CatView {
  m: CatModel; id: number; label: THREE.Sprite; mood: 'none' | 'angry' | 'happy'; moodT: number; flashT: number; seen: number;
}

export class CatsView {
  private views = new Map<number, CatView>();
  private frame = 0;
  cheer = false;
  constructor(private root: THREE.Object3D) {}

  private create(s: GameState, c: Cat): CatView {
    const team = c.team >= 0 ? s.dayState!.teams.find((t) => t.id === c.team) : undefined;
    let role: CatRole = c.kind === 'guest' ? 'guest' : c.kind;
    if (team?.vip) role = 'vip';
    else if (team?.tourist) role = 'tourist';
    const staff = c.staff >= 0 ? s.staff.find((m) => m.id === c.staff) : undefined;
    const badge = staff ? (staff.grade === 3 ? 2 : staff.grade === 2 ? 1 : 0) : 0;
    const m = makeCat({ fur: FURS[c.fur % FURS.length], role, scarf: SCARVES[c.scarf % SCARVES.length], badge: badge as 0 | 1 | 2 }, (c.id * 1.7) % 6);
    this.root.add(m.g);
    const label = new THREE.Sprite(labelMats().nyam);
    label.renderOrder = 18; label.visible = false; label.scale.set(0.38 * 2, 0.38, 1);
    m.g.add(label);
    const v: CatView = { m, id: c.id, label, mood: 'none', moodT: 0, flashT: 0, seen: 0 };
    this.views.set(c.id, v);
    return v;
  }

  get(id: number): CatModel | undefined { return this.views.get(id)?.m; }
  all(): CatModel[] { return [...this.views.values()].map((v) => v.m); }
  entries(): Array<[number, CatModel]> { return [...this.views.entries()].map(([k, v]) => [k, v.m]); }

  angry(teamCats: number[]): void {
    for (const id of teamCats) { const v = this.views.get(id); if (v) { v.mood = 'angry'; v.moodT = 0; v.flashT = 0.18; } }
  }
  happy(teamCats: number[]): void {
    for (const id of teamCats) { const v = this.views.get(id); if (v) { v.mood = 'happy'; v.moodT = 0; } }
  }

  clear(): void {
    for (const v of this.views.values()) v.m.g.removeFromParent();
    this.views.clear();
  }

  update(s: GameState, alpha: number, t: number, dt: number): void {
    const ds = s.dayState;
    this.frame++;
    if (!ds) { this.clear(); return; }
    const teamById = new Map<number, Team>();
    for (const tm of ds.teams) teamById.set(tm.id, tm);
    for (const c of ds.cats) {
      const v = this.views.get(c.id) ?? this.create(s, c);
      v.seen = this.frame;
      this.pose(s, c, v, teamById.get(c.team), alpha, t, dt);
    }
    for (const [id, v] of this.views) if (v.seen !== this.frame) { v.m.g.removeFromParent(); this.views.delete(id); }
  }

  private pose(s: GameState, c: Cat, v: CatView, team: Team | undefined, alpha: number, t: number, dt: number): void {
    const m = v.m;
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    let dr = c.ry - c.pry;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    m.g.position.set(lerp(c.px, c.x), lerp(c.py, c.y), lerp(c.pz, c.z));
    m.g.rotation.y = c.pry + dr * alpha;
    m.shadow.position.y = -m.g.position.y + 0.014;
    m.g.visible = c.state !== 'spawnWait';
    // 기본 자세
    m.body.scale.y = 1.08 * (1 + 0.022 * Math.sin(t * 3 + m.ph));
    m.tail.rotation.y = CAT_DIM.tailWag * Math.sin(t * 2.4 + m.ph);
    m.bodyPivot.position.y = 0.02;
    m.bodyPivot.rotation.set(0, 0, 0);
    m.pawR.position.copy(m.pawR0);
    m.pawL.position.copy(m.pawL0);
    m.earL.rotation.x = 0; m.earR.rotation.x = 0;
    let label: keyof NonNullable<typeof mats> | null = null;
    const walking = c.moving || (c.kind === 'guest' && (c.state === 'toSeat' || c.state === 'toExit' || c.state === 'enterSeat' || c.state === 'exitSeat') && Math.hypot(c.x - c.px, c.z - c.pz) > 1e-4);
    if (walking || (c.state === 'queue' && Math.hypot(c.x - c.px, c.z - c.pz) > 1e-4)) {
      m.bodyPivot.position.y = 0.02 + Math.abs(Math.sin(t * 22 + m.ph)) * 0.07;
      // 걸을 때 꼬리는 뒤로 곧게 (옆으로 흔들면 의자 옆을 지날 때 쓸린다)
      m.tail.rotation.y *= WALK_TAIL;
    }
    if (c.kind === 'guest' && team) {
      const seated = c.state === 'seated';
      const lead = team.members[0] === c.id;
      const o = team.orders.find((x) => team.members[x.member] === c.id);
      if (seated && team.state === 'seated') {
        if (o && o.served && o.eatT < TABLE.eatSec) {
          m.bodyPivot.rotation.x = EAT_LEAN * (0.5 + 0.5 * Math.sin(t * 9 + m.ph));
          if (Math.sin(t * 4 + m.ph) > 0.3) label = 'nyam';
        } else if (lead && !team.orderTaken) {
          m.pawR.position.set(0.32, 0.8 + Math.sin(t * 12) * 0.05, 0.12);
        } else if (!o?.served) {
          const lvl = patienceLevel(patienceUsed(s, team));
          const stomper = team.members[Math.min(1, team.members.length - 1)] === c.id;
          if (lvl !== 'ok' && stomper) {
            m.pawL.position.y = m.pawL0.y + Math.abs(Math.sin(t * 13)) * 0.08;
            m.bodyPivot.rotation.z = Math.sin(t * 13) * 0.03;
            if (Math.sin(t * 13) > -0.2) label = 'tak';
          }
        }
      }
      if (team.angry || v.mood === 'angry') {
        v.mood = 'angry';
        m.earL.rotation.x = -0.6; m.earR.rotation.x = -0.6;
        label = 'hmph';
      } else if (team.state === 'leaving' && v.mood !== 'happy') { v.mood = 'happy'; v.moodT = 0; }
      if (v.mood === 'happy' && v.moodT < 1.2) label = 'heart';
    }
    if (c.kind === 'chef' && c.actT > 0) {
      m.pawR.position.y = m.pawR0.y + Math.max(0, Math.sin(t * 9)) * 0.1;
      m.pawL.position.y = m.pawL0.y + Math.max(0, Math.sin(t * 9 + 2)) * 0.1;
    }
    if (c.kind === 'dish' && c.actT > 0) {
      m.pawR.position.y = m.pawR0.y + Math.max(0, Math.sin(t * 14)) * 0.09;
      m.pawL.position.y = m.pawL0.y + Math.max(0, Math.sin(t * 14 + 1.6)) * 0.09;
    }
    if (c.kind === 'server' && m.tray) {
      m.trayBowls.forEach((b, i) => {
        const d = c.carry[i];
        b.visible = !!d;
        if (d) setBowl(b, d.menu);
      });
    }
    if (this.cheer) {
      // 만세: 두 앞발을 머리 옆으로 (몸 폭 안) + 통통
      m.pawL.position.set(-0.3, 0.8 + Math.sin(t * 10 + m.ph) * 0.05, 0.1);
      m.pawR.position.set(0.3, 0.8 + Math.sin(t * 10 + m.ph + 1) * 0.05, 0.1);
      m.bodyPivot.position.y = 0.02 + Math.abs(Math.sin(t * 7 + m.ph)) * 0.08;
      m.bodyPivot.rotation.x = 0;
      label = Math.sin(t * 3 + m.ph) > 0.4 ? 'heart' : null;
      v.moodT = (t * 0.5) % 1;
    }
    v.moodT += dt;
    if (v.flashT > 0) { v.flashT -= dt; m.flash(v.flashT > 0); }
    if (label) {
      const lm = labelMats();
      v.label.material = lm[label];
      v.label.visible = true;
      const sc = label === 'heart' ? 0.4 : label === 'tak' ? 0.42 : 0.38;
      v.label.scale.set(label === 'tak' ? sc * 1.33 : label === 'heart' ? sc : sc * 2, sc, 1);
      const rise = label === 'heart' ? v.moodT * 0.5 : 0;
      if (label === 'tak') v.label.position.set(0.42, 0.45, 0.25);
      else v.label.position.set(0.36, 1.18 + rise, 0);
    } else v.label.visible = false;
    void SEAT_RULES;
  }
}
