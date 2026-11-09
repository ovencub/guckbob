// 디버그 프리셋: 직원 풀세트 + 가게 4단계 (e2e·겹침 검사용)
import { CHEF } from './data/staff';
import { hire } from './sim/catalog';
import type { GameState } from './sim/types';

export function applyPreset(s: GameState, name: 'full' | 'near' = 'full'): void {
  if (name === 'near') { nearMichelin(s); return; }
  if (name !== 'full') return;
  s.stage = 3; s.burners = 6; s.bowls = 30; s.sinkLevel = 3; s.kiosk = true; s.tier = 4; s.taste = 4; s.costCut = 5;
  s.menus = { sundae: true, spicy: true, suyuk: true };
  s.staff = [];
  for (let i = 0; i < CHEF.max; i++) hire(s, 'chef', 3);
  hire(s, 'server', 3); hire(s, 'server', 2); hire(s, 'dish', 3);
  s.promos = [{ id: 'youtube', days: 3 }];
  s.reviews = [];
  for (let i = 0; i < 50; i++) s.reviews.push(4.6);
  s.money = 5000000;
}

/** 미슐랭 직전: 관광맛집·귀빈 인정·별점 5.0·매출 충분. 그날 정산에서 미슐랭 */
export function nearMichelin(s: GameState): void {
  applyPreset(s, 'full');
  s.vipOk = true;
  s.promos = [];
  s.tierDays = [1, 3, 6, 9, 12];
  s.day = 17;
  s.revenues = [3_000_000, 3_000_000, 3_000_000];
  s.reviews = Array.from({ length: 50 }, () => 5);
  s.stats = { teams: 900, guests: 2100, bowls: 1800, revenue: 21_000_000, bestDay: 2_100_000, burnt: 12, angry: 9, missed: 300 };
  s.playSec = 47 * 60 + 12;
}
