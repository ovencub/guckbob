// 연속 서빙·수금 콤보 (손맛 전용, 점수 영향 없음)
import { COMBO } from '../data/balance';
import type { GameState, SimEvent } from './types';

type Emit = (e: SimEvent) => void;

export function bumpCombo(s: GameState, emit: Emit): void {
  const ds = s.dayState!;
  ds.comboN = ds.comboT > 0 ? ds.comboN + 1 : 1;
  ds.comboT = COMBO.windowSec;
  if (ds.comboN >= 2) emit({ k: 'combo', n: ds.comboN });
}
export function endCombo(s: GameState): void {
  const ds = s.dayState;
  if (ds) { ds.comboN = 0; ds.comboT = 0; }
}

