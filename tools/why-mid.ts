// 사람이 흔히 가는 중반 구성에서 손님 몰릴 때 화난 손님이 생기는가
import { SIM_DT } from '../src/data/balance';
import { PlayerBot } from '../src/sim/bot';
import { hire } from '../src/sim/catalog';
import { startDay, step } from '../src/sim/sim';
import { newGame } from '../src/sim/state';
import type { GameState, SimEvent } from '../src/sim/types';
import type { PromoId } from '../src/data/promos';

function run(name: string, setup: (s: GameState) => void, tap = 1.3): void {
  let ang = 0, angT = 0, rev = 0, sold = 0, chefCook = 0, playerCook = 0, waitOrder = 0, waitFood = 0;
  const N = 4;
  for (let k = 0; k < N; k++) {
    const s = newGame(50 + k); s.tutorial = false; setup(s); startDay(s);
    const b = new PlayerBot(tap); const ev: SimEvent[] = [];
    while (s.phase !== 'settle') {
      b.tick(s, SIM_DT, ev); step(s, ev);
      for (const e of ev) if (e.k === 'cook') { if (e.by < 0) playerCook++; else chefCook++; }
      ev.length = 0;
      for (const t of s.dayState!.teams) if (t.state === 'seated') { if (!t.orderTaken) waitOrder += SIM_DT; else if (t.orders.some((o) => !o.served)) waitFood += SIM_DT; }
    }
    const r = s.lastReport!; ang += r.angry; angT += r.angryTeams; rev += r.reviewAvg; sold += r.sold;
  }
  console.log(`${name.padEnd(36)} 화난 ${(angT / N).toFixed(1)}팀(${(ang / N).toFixed(1)}명)/일 · 리뷰 ${(rev / N).toFixed(2)} · 판매 ${(sold / N).toFixed(0)} · 조리 주방장:플레이어 ${chefCook}:${playerCook} · 주문 대기 ${(waitOrder / N).toFixed(0)}s · 음식 대기 ${(waitFood / N).toFixed(0)}s`);
}
const mid = (promo: PromoId[] = [], kiosk = false, chefs = 1, burners = 4, sg = 1) => (s: GameState) => {
  s.stage = 1; s.burners = burners; s.bowls = 16; s.sinkLevel = 1; s.kiosk = kiosk; s.menus.spicy = true; s.tier = 2; s.taste = 2;
  hire(s, 'server', sg as 0); hire(s, 'server', sg as 0); for (let i = 0; i < chefs; i++) hire(s, 'chef', 1); hire(s, 'dish', 0);
  s.reviews = Array.from({ length: 50 }, () => 2.8);
  s.promos = promo.map((id) => ({ id, days: 2 }));
};
run('중반: 서버2·주방장1·화구4·키오스크X', mid());
run('  + 구글·유튜브 광고(손님 몰림)', mid(['google', 'youtube']));
run('  + 광고 + 키오스크', mid(['google', 'youtube'], true));
run('  + 광고 + 키오스크 + 주방장2', mid(['google', 'youtube'], true, 2));
run('  + 광고, 서버 견습(1그릇씩)', mid(['google', 'youtube'], false, 1, 4, 0));
