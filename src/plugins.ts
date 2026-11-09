// 앱 플러그인: 소리·BGM·튜토리얼·엔딩·결과·공유·도전장
import type { App, AppPlugins } from './app';
import { Audio } from './audio/sfx';
import { Bgm } from './audio/bgm';
import { DAY } from './data/balance';
import { SHARE } from './data/share';
import { TIERS } from './data/tiers';
import { clearSave, save } from './save/storage';
import { skipTutorial, continueEndless } from './sim/sim';
import { ratingShown } from './sim/state';
import { celebrationScene, playEnding, showResult } from './ui/ending';
import { fmtMoney } from './ui/hud';
import { decodeResult, drawCard, encodeResult, resultUrl, shareCard, titleFor, type ResultCode } from './ui/share';
import { Tutorial } from './ui/tutorial';

const CH_KEY = 'guckbob.challenge.v1';

function loadChallenge(): ResultCode | null {
  try { return decodeResult(localStorage.getItem(CH_KEY)); } catch { return null; }
}

export function makePlugins(params: URLSearchParams): { plugins: AppPlugins; attach(app: App): void } {
  const audio = new Audio();
  const bgm = new Bgm(audio);
  let tut: Tutorial | null = null;
  const rawR = params.get('r');
  const incoming = decodeResult(rawR);
  let app: App;

  const shareResult = (a: App) => {
    const s = a.s;
    const days = s.michelinDay || s.day;
    const t = titleFor(days);
    const minutes = Math.round(s.playSec / 60);
    const code = encodeResult({ n: s.shopName, d: days, m: minutes, s: ratingShown(s), c: s.stats.guests, t: t.code });
    const card = drawCard({
      shop: s.shopName, big: `${days}일 만에 미슐랭!`, title: t.name, furs: s.staff.map((m) => m.fur).concat([0, 1, 2]),
      lines: [['플레이 시간', `${minutes}분`], ['가게 별점', `★${ratingShown(s).toFixed(1)}`], ['받은 손님', `${s.stats.guests.toLocaleString('ko-KR')}명`]],
    });
    void shareCard(card, `${s.shopName}, ${days}일 만에 미슐랭! 나도 도전해 봐`, resultUrl(code), (m) => a.game.toasts.show(m, 'good'));
  };

  const shareDay = (a: App) => {
    const r = a.s.lastReport;
    if (!r) return;
    const card = drawCard({
      shop: a.s.shopName, big: `${r.day}일차 영업 끝!`, title: TIERS[r.tierAfter].name, furs: [r.day % 6, 2, (r.day + 3) % 6],
      lines: [['오늘 매출', `${fmtMoney(r.revenue)}원`], ['순수익', `${fmtMoney(r.net)}원`], ['가게 별점', `★${r.ratingAfter.toFixed(1)}`]],
    });
    void shareCard(card, `${a.s.shopName} ${r.day}일차 영업 끝! 매출 ${fmtMoney(r.revenue)}원`, SHARE.url, (m) => a.game.toasts.show(m, 'good')).catch(() => {});
  };

  const plugins: AppPlugins = {
    challenge: incoming ? { name: incoming.n, days: incoming.d, minutes: incoming.m, title: titleFor(incoming.d).name } : null,
    onTap: (a) => { audio.unlock(); audio.setMuted(a.muted); audio.play('tap'); },
    onEvent: (a, e) => {
      const ds = a.s.dayState;
      const combo = ds ? ds.comboN : 0;
      switch (e.k) {
        case 'cook': if (e.by < 0) audio.play('sizzle'); break;
        case 'cookDone': if (ds && ds.burners[e.burner]?.by < 0) audio.play('ding'); break;
        case 'burn': audio.play('burn'); a.game.world.shake(); break;
        case 'serve': audio.play('serve', combo); break;
        case 'paid': if (e.amount > 0) audio.play('coin', combo); break;
        case 'wash': if (e.by < 0) { audio.play('wash'); tut?.noteWash(); } break;
        case 'angry': audio.play('angry'); a.game.world.shake(); break;
        case 'nope': audio.play('nope'); break;
        case 'open': bgm.rush = false; bgm.start(); break;
        case 'dayEnd': bgm.stop(); break;
        default: break;
      }
      if (ds && a.s.phase === 'open') bgm.rush = ds.t >= DAY.openSec - DAY.bgmRushSec;
    },
    onPhase: (a, phase) => {
      if (phase === 'open' && a.s.day === 1 && a.s.tutorial) {
        tut = tut ?? new Tutorial(a.ui);
        tut.onEnd = (skipped) => { if (skipped) skipTutorial(a.s); a.s.tutorial = false; };
        tut.start();
        a.frameHook = (dt) => tut?.update(a.game, dt);
      }
      if (phase === 'tierup') audio.play('tierup');
      if (phase === 'prep' || phase === 'settle') bgm.stop();
    },
    share: (a, kind) => (kind === 'day' ? shareDay(a) : shareResult(a)),
    ending: (a) => {
      const s = a.s;
      celebrationScene(s);
      a.game.world.cats.cheer = true;
      a.game.world.sync(s);
      a.game.hud.show(false);
      audio.play('ending');
      playEnding(a.ui, () => {
        showResult(a.ui, s, loadChallenge(), {
          share: () => shareResult(a),
          endless: () => {
            a.game.world.cats.cheer = false;
            s.dayState = null;
            continueEndless(s);
            save(s);
            a.game.hud.show(true);
            a.enterPrep();
          },
          restart: () => {
            a.game.world.cats.cheer = false;
            s.dayState = null;
            clearSave();
            a.game.hud.show(false);
            a.showStart(true);
          },
        });
      });
    },
  };

  return {
    plugins,
    attach(a: App) {
      app = a;
      if (incoming && rawR) { try { localStorage.setItem(CH_KEY, rawR); } catch { /* 무시 */ } }
      else if (!rawR) { /* 도전장 없이 들어오면 예전 도전장은 유지 (진행 중일 수 있음) */ }
      window.addEventListener('pointerdown', () => { audio.unlock(); audio.setMuted(app.muted); }, { once: true });
      a.onMute = (m) => audio.setMuted(m);
    },
  };
}
