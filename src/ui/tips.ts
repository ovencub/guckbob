// 하단 상황 팁 한 줄: 지금 가장 급한 일을 짧고 구체적으로
import { KITCHEN } from '../data/balance';
import { patienceLevel, patienceUsed } from '../sim/customers';
import { sinkCap } from '../sim/state';
import type { GameState } from '../sim/types';

export function tipFor(s: GameState): string {
  const ds = s.dayState;
  if (!ds) return '다음 영업을 준비하세요.';
  if (s.phase === 'countdown') return '영업 시작! 손님이 몰려와요.';
  if (s.phase === 'overtime') return '마감! 남은 손님만 마무리하세요.';
  const burning = ds.burners.find((b) => b.phase === 'done' && b.by < 0 && b.t > KITCHEN.burnSec * 0.4);
  if (burning) return '완료! 뜬 화구를 눌러 배식대로 옮기세요. 늦으면 국밥이 타요.';
  if (ds.burners.some((b) => b.phase === 'burnt')) return '탄 냄비는 개수대에 자리가 나야 치워져요. 개수대를 눌러 설거지!';
  if (ds.clean === 0 && ds.sink > 0) return '그릇이 없어요! 개수대를 연타해서 설거지하세요.';
  if (ds.sink >= sinkCap(s)) return '개수대가 꽉 찼어요. 설거지해야 테이블을 치울 수 있어요.';
  const hurry = ds.teams.find((t) => t.state === 'seated' && patienceLevel(patienceUsed(s, t)) === 'danger');
  if (hurry) return '빨간 게이지! 그 테이블 국밥부터 서빙하세요.';
  if (ds.pass.some((p) => p)) return '배식대 국밥을 누르면 가장 오래 기다린 테이블로 날아가요.';
  if (ds.teams.some((t) => t.state === 'seated' && !t.orderTaken)) return '"주문!" 테이블을 눌러 주문을 받으세요.';
  if (ds.tables.some((t) => t.dirty)) return '동전이 뜬 테이블을 눌러 수금하고 치우세요.';
  if (ds.teams.some((t) => t.state === 'seated' && t.orderTaken)) return '빈 화구를 눌러 국밥을 끓이세요.';
  if (ds.sink > 0) return '틈날 때 개수대를 눌러 그릇을 씻어 두세요.';
  return '손님이 오면 테이블을 눌러 주문을 받으세요.';
}
