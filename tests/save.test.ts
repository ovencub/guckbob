import { describe, expect, it } from 'vitest';
import { migrate } from '../src/save/storage';
import { newGame, SAVE_VERSION } from '../src/sim/state';

describe('저장 (guckbob.save.v1)', () => {
  it('현재 버전 저장은 그대로 복원', () => {
    const s = newGame(3);
    s.money = 12345;
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back?.money).toBe(12345);
    expect(back?.version).toBe(SAVE_VERSION);
  });
  it('미래 버전·깨진 저장은 무시', () => {
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
    expect(migrate({ version: SAVE_VERSION, day: 'x' })).toBeNull();
  });
});
