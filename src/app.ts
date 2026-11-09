// 앱 흐름: 시작 화면 → 영업 → 정산 → (티어 업) → 정비 → 영업 … → 미슐랭 엔딩
import { TIMING } from './data/view';
import { Game } from './game';
import { clearSave, load, loadPrefs, save, savePrefs } from './save/storage';
import { finishSettle, startDay } from './sim/sim';
import { newGame } from './sim/state';
import type { GameState, SimEvent } from './sim/types';
import { PrepSheet } from './ui/prep/sheet';
import { Settlement } from './ui/settlement';
import { askName, showStart, type StartOpts } from './ui/start';
import { showTierUp } from './ui/tier';

export interface AppPlugins {
  onEvent?(app: App, e: SimEvent): void;
  onTap?(app: App, ok: boolean): void;
  onPhase?(app: App, phase: string): void;
  share?(app: App, kind: 'day' | 'result'): void;
  ending?(app: App): void;
  challenge?: StartOpts['challenge'];
}

export class App {
  game: Game;
  readonly settle: Settlement;
  readonly prep: PrepSheet;
  muted: boolean;
  private lastFrame = 0;
  private hiddenSince = 0;

  constructor(private canvas: HTMLCanvasElement, readonly ui: HTMLElement, readonly plugins: AppPlugins = {}) {
    this.muted = loadPrefs().muted;
    const s0 = newGame(1);
    const app = this;
    this.game = new Game(s0, canvas, ui, {
      onEvent: (e) => this.onEvent(e),
      onTap: (ok) => plugins.onTap?.(this, ok),
      onDayEnd: () => this.dayEnded(),
      sound: { get muted() { return app.muted; }, toggle: () => this.toggleMute() },
    });
    this.game.hud.show(true);
    this.settle = new Settlement(ui);
    this.prep = new PrepSheet(ui);
    this.settle.onConfirm = () => this.afterSettle();
    this.settle.onShare = () => plugins.share?.(this, 'day');
    this.prep.onNext = () => this.nextDay();
    this.prep.onChange = () => { save(this.s); this.game.world.sync(this.s); this.game.updateHud(); };
    this.prep.onRename = () => askName(ui, this.s.shopName, '가게 이름 바꾸기', (n) => { if (n) { this.s.shopName = n; save(this.s); this.prep.render(); } });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.hiddenSince = performance.now(); if (this.live) this.game.setPaused(true); }
    });
    requestAnimationFrame((t) => this.loop(t));
  }

  get s(): GameState { return this.game.s; }
  get live(): boolean { return ['countdown', 'open', 'overtime'].includes(this.s.phase); }

  toggleMute(): void { this.muted = !this.muted; savePrefs({ muted: this.muted }); this.game.updateHud(); }

  showStart(): void {
    const saved = load();
    this.game.hud.show(false);
    showStart(this.ui, {
      saveDay: saved && saved.phase === 'prep' ? saved.day : null,
      challenge: this.plugins.challenge ?? null,
      onContinue: () => { if (saved) { this.game.hud.show(true); this.game.setState(saved); this.enterPrep(); } },
      onNew: (name) => this.newGame(name),
    });
  }

  newGame(name: string, seed = Math.floor(Math.random() * 1e9), setup?: (s: GameState) => void): void {
    clearSave();
    this.game.hud.show(true);
    const s = newGame(seed, name);
    setup?.(s);
    this.game.setState(s);
    // 1일차는 돈이 없어 정비할 게 없으니 바로 영업
    this.beginDay();
  }

  private beginDay(): void {
    this.prep.hide();
    this.game.r.camera.resetView();
    startDay(this.s);
    this.game.world.sync(this.s);
    this.game.toasts.banner('영업 시작!', TIMING.startBannerSec);
    this.plugins.onPhase?.(this, 'open');
  }

  private nextDay(): void {
    save(this.s);
    this.beginDay();
  }

  private onEvent(e: SimEvent): void {
    if (e.k === 'close') this.game.toasts.banner('마감!', TIMING.startBannerSec);
    this.plugins.onEvent?.(this, e);
  }

  private dayEnded(): void {
    const r = this.s.lastReport;
    if (!r || this.settle.visible) return;
    this.game.setPaused(false);
    this.settle.show(this.s, r);
    this.plugins.onPhase?.(this, 'settle');
  }

  private afterSettle(): void {
    const r = this.s.lastReport!;
    finishSettle(this.s);
    this.game.world.clearDay();
    save(this.s);
    const go = () => {
      if (this.s.phase === 'ended') { this.plugins.ending?.(this); return; }
      this.enterPrep();
    };
    if (r.tierAfter > r.tierBefore) {
      this.game.world.sync(this.s);
      this.plugins.onPhase?.(this, 'tierup');
      showTierUp(this.ui, r.tierAfter, go);
    } else go();
  }

  enterPrep(): void {
    this.s.phase = this.s.phase === 'ended' ? 'prep' : this.s.phase;
    this.game.world.sync(this.s);
    this.game.updateHud();
    this.prep.show(this.s);
    this.plugins.onPhase?.(this, 'prep');
  }

  /** 플레이 시간: 영업·정산·정비 (일시정지·탭 비활성 제외) */
  private loop(t: number): void {
    const dt = this.lastFrame ? Math.min(0.25, (t - this.lastFrame) / 1000) : 0;
    this.lastFrame = t;
    const counting = !document.hidden && !this.game.paused && (this.live || this.settle.visible || this.prep.visible);
    if (counting) this.s.playSec += dt;
    this.game.frame(t);
    void this.hiddenSince;
    void this.canvas;
    requestAnimationFrame((n) => this.loop(n));
  }
}
