// 게임 컨트롤러: 고정 스텝 루프, 입력 → 명령, sim 이벤트 → 연출·소리·HUD
import * as THREE from 'three';
import { DAY, SIM_DT } from './data/balance';
import { TIMING } from './data/view';
import type { MenuId } from './data/menus';
import { TIERS } from './data/tiers';
import { Picker, type Pick } from './input/picker';
import { Renderer } from './render/renderer';
import { World } from './render/world';
import * as cmd from './sim/commands';
import { unmetCount, oldestWaiting } from './sim/kitchen';
import { step } from './sim/sim';
import { ratingShown, sinkCap } from './sim/state';
import type { GameState, SimEvent } from './sim/types';
import { BurnerMenu } from './ui/burnerMenu';
import { Hud } from './ui/hud';
import { tipFor } from './ui/tips';
import { Toasts } from './ui/toast';

export interface GameHooks {
  onEvent(e: SimEvent): void;
  onTap(ok: boolean): void;
  onDayEnd(): void;
  sound: { muted: boolean; toggle(): void };
}

export class Game {
  readonly r: Renderer;
  readonly world: World;
  readonly hud: Hud;
  readonly toasts: Toasts;
  readonly menu: BurnerMenu;
  readonly picker: Picker;
  private acc = 0;
  private last = 0;
  paused = false;
  private shownMoney = 0;
  private moneyFrom = 0;
  private moneyT = 1;
  private events: SimEvent[] = [];
  private dragGhost: HTMLDivElement;
  private dragSlot = -1;
  private stepsPerFrameMax = 8;
  speed = 1;
  botTick: ((dt: number) => void) | null = null;

  constructor(public s: GameState, canvas: HTMLCanvasElement, private ui: HTMLElement, private hooks: GameHooks) {
    this.r = new Renderer(canvas);
    this.world = new World(this.r);
    this.hud = new Hud(ui);
    this.toasts = new Toasts(ui);
    this.menu = new BurnerMenu(ui);
    this.dragGhost = document.createElement('div');
    this.dragGhost.className = 'drag-ghost';
    ui.appendChild(this.dragGhost);
    this.shownMoney = s.money;
    this.menu.onPick = (b, m) => this.cook(b, m);
    this.hud.onPause = () => this.setPaused(!this.paused);
    this.hud.onMute = () => this.hooks.sound.toggle();
    this.world.onPaid = (amount, pos) => this.coinToHud(amount, pos);
    this.picker = new Picker(this.r, () => this.world.hits, {
      tap: (p) => this.tap(p),
      dragStart: (p, x, y) => this.dragStart(p, x, y),
      dragMove: (x, y) => this.dragMove(x, y),
      dragEnd: (p) => this.dragEnd(p),
      pan: (dx, dy) => { this.menu.hide(); this.r.camera.pan(dx, dy); },
      pinch: (k) => { this.menu.hide(); this.r.camera.setZoom(this.r.camera.zoom * k); },
    });
    this.world.sync(s);
    this.r.resize();
    new ResizeObserver(() => this.r.resize()).observe(canvas);
  }

  setState(s: GameState): void {
    this.s = s;
    this.shownMoney = s.money;
    this.world.clearDay();
    this.world.sync(s);
  }

  setPaused(p: boolean): void { this.paused = p; if (p) this.menu.hide(); }

  /** 매 프레임 (requestAnimationFrame) */
  frame(now: number): void {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    const s = this.s;
    const live = s.phase === 'countdown' || s.phase === 'open' || s.phase === 'overtime';
    if (live && !this.paused) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= SIM_DT && n < this.stepsPerFrameMax * this.speed) {
        this.botTick?.(SIM_DT);
        step(s, this.events);
        this.acc -= SIM_DT;
        n++;
        this.flush();
        if (s.phase === 'settle') break;
      }
      if (s.phase === 'settle') this.acc = 0;
    }
    if (s.phase === 'settle') this.hooks.onDayEnd();
    const alpha = live ? Math.min(1, this.acc / SIM_DT) : 1;
    this.world.update(s, alpha, this.paused ? 0 : dt);
    if (this.moneyT < 1) {
      this.moneyT = Math.min(1, this.moneyT + dt / TIMING.countUpSec);
      this.shownMoney = this.moneyFrom + (s.money - this.moneyFrom) * this.moneyT;
    } else if (Math.abs(this.shownMoney - s.money) > 0 && !this.pendingCoins) this.shownMoney = s.money;
    this.updateHud();
    this.r.trackFps(dt);
    this.r.render();
  }

  private pendingCoins = 0;

  /** 밖에서 만든 이벤트 처리 (봇·디버그) */
  feed(ev: SimEvent[]): void {
    for (const e of ev) this.events.push(e);
    ev.length = 0;
    this.flush();
  }

  private flush(): void {
    for (const e of this.events) {
      this.world.handle(this.s, e);
      if (e.k === 'toast') this.toasts.show(e.msg);
      this.hooks.onEvent(e);
    }
    this.events.length = 0;
  }

  updateHud(): void {
    const s = this.s;
    const ds = s.dayState;
    this.hud.update({
      money: s.money, rating: ratingShown(s), tierName: TIERS[s.tier].name, day: s.day,
      progress: ds ? ds.t / DAY.openSec : 0, closed: s.phase === 'overtime' || s.phase === 'settle',
      clean: ds ? ds.clean : s.bowls, bowls: s.bowls, sink: ds ? ds.sink : 0, sinkCap: sinkCap(s), queue: ds ? ds.queue.length : 0,
      tip: tipFor(s), paused: this.paused, muted: this.hooks.sound.muted,
    }, this.shownMoney);
  }

  // ---------- 입력 ----------
  private screenOf(p: THREE.Vector3): { x: number; y: number } { return this.r.toScreen(p, { x: 0, y: 0 }); }

  private nearestPassSlot(point: THREE.Vector3, servable: boolean): number {
    const ds = this.s.dayState;
    if (!ds) return -1;
    const v = new THREE.Vector3();
    let best = -1;
    let bd = Infinity;
    ds.pass.forEach((p, i) => {
      if (!p || p.res) return;
      if (servable && !oldestWaiting(this.s, p.menu)) return;
      this.world.kitchen.passPos(i, v);
      const d = Math.hypot(v.x - point.x, v.z - point.z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  tap(p: Pick | null): void {
    const ev = this.events;
    if (this.menu.open) { this.menu.hide(); if (!p || p.kind !== 'burner') return; }
    if (!p || this.paused) return;
    const s = this.s;
    let ok: boolean | 'menu' = false;
    switch (p.kind) {
      case 'table': ok = cmd.tapTable(s, p.id, ev); break;
      case 'burner': {
        ok = cmd.tapBurner(s, p.id, ev);
        if (ok === 'menu') {
          const v = this.world.kitchen.burnerPos(p.id, new THREE.Vector3());
          v.y = 1.6;
          const sc = this.screenOf(v);
          this.menu.show(p.id, sc.x, sc.y, s.menus, unmetCount(s), s.tier);
        }
        break;
      }
      case 'pass': {
        let slot = this.nearestPassSlot(p.point, true);
        if (slot < 0) slot = this.nearestPassSlot(p.point, false);
        if (slot >= 0) ok = cmd.serve(s, slot, ev);
        break;
      }
      case 'sink': ok = cmd.wash(s, ev); break;
      default: break;
    }
    this.hooks.onTap(ok !== false);
    this.flush();
  }

  private cook(burner: number, menu: MenuId): void {
    cmd.startCook(this.s, burner, menu, this.events);
    this.flush();
  }

  private dragStart(p: Pick | null, x: number, y: number): boolean {
    if (!p || p.kind !== 'pass' || this.paused) return false;
    const slot = this.nearestPassSlot(p.point, false);
    if (slot < 0) return false;
    this.dragSlot = slot;
    this.world.kitchen.passHidden.set(slot, Number.POSITIVE_INFINITY);
    const d = this.s.dayState!.pass[slot]!;
    this.dragGhost.className = `drag-ghost on m-${d.menu}`;
    this.dragMove(x, y);
    return true;
  }

  private dragMove(x: number, y: number): void {
    const r = this.ui.getBoundingClientRect();
    this.dragGhost.style.transform = `translate(${x - r.left - 30}px, ${y - r.top - 40}px)`;
  }

  private dragEnd(p: Pick | null): void {
    const slot = this.dragSlot;
    this.dragSlot = -1;
    this.dragGhost.className = 'drag-ghost';
    this.world.kitchen.passHidden.delete(slot);
    if (slot < 0) return;
    if (p && p.kind === 'table') {
      if (!cmd.serve(this.s, slot, this.events, p.id)) this.toasts.show('그 테이블은 이 메뉴를 기다리지 않아요');
    }
    this.flush();
  }

  // ---------- 동전 → HUD ----------
  private coinToHud(amount: number, pos: THREE.Vector3): void {
    const sc = this.screenOf(pos);
    const target = this.hud.moneyEl.getBoundingClientRect();
    const r = this.ui.getBoundingClientRect();
    const c = document.createElement('div');
    c.className = 'fly-coin';
    c.style.transform = `translate(${sc.x - 14}px, ${sc.y - 14}px)`;
    this.ui.appendChild(c);
    this.pendingCoins++;
    requestAnimationFrame(() => {
      c.style.transition = `transform ${TIMING.coinFlySec}s cubic-bezier(.5,-0.3,.8,.6)`;
      c.style.transform = `translate(${target.left - r.left + 6}px, ${target.top - r.top + 4}px) scale(.7)`;
    });
    setTimeout(() => {
      c.remove();
      this.pendingCoins = Math.max(0, this.pendingCoins - 1);
      this.moneyFrom = this.shownMoney;
      this.moneyT = 0;
      this.hud.moneyEl.classList.remove('bump'); void this.hud.moneyEl.offsetWidth; this.hud.moneyEl.classList.add('bump');
    }, TIMING.coinFlySec * 1000);
    void amount;
  }
}
