// 디버그 프리셋: 직원 풀세트 + 가게 4단계 (e2e·겹침 검사용)
import { CHEF } from './data/staff';
import { hire } from './sim/catalog';
import type { GameState } from './sim/types';

export function applyPreset(s: GameState, name: 'full' = 'full'): void {
  if (name !== 'full') return;
  s.stage = 3; s.burners = 6; s.bowls = 30; s.sinkLevel = 3; s.kiosk = true; s.tier = 4;
  s.menus = { sundae: true, spicy: true, suyuk: true };
  s.staff = [];
  for (let i = 0; i < CHEF.max; i++) hire(s, 'chef', 3);
  hire(s, 'server', 3); hire(s, 'server', 2); hire(s, 'dish', 3);
  s.promos = [{ id: 'youtube', days: 3 }];
  s.reviews = [];
  for (let i = 0; i < 50; i++) s.reviews.push(4.6);
  s.money = 5000000;
}
