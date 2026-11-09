// localStorage 저장 (키 guckbob.save.v1). 정산 직후와 정비 시간 구매마다 저장한다.
// 구조를 바꾸면 SAVE_VERSION 을 올리고 MIGRATIONS 에 변환 함수를 추가한다.
import { SAVE_VERSION } from '../sim/state';
import type { GameState } from '../sim/types';

export const SAVE_KEY = 'guckbob.save.v1';
export const PREFS_KEY = 'guckbob.prefs.v1';

type AnySave = Record<string, unknown> & { version?: number };

// version n → n+1 변환. 지금은 v1 뿐이라 비어 있다
const MIGRATIONS: Record<number, (s: AnySave) => AnySave> = {};

export function migrate(raw: AnySave): GameState | null {
  let s = raw;
  let v = typeof s.version === 'number' ? s.version : 0;
  if (v > SAVE_VERSION) return null;
  while (v < SAVE_VERSION) {
    const f = MIGRATIONS[v];
    if (!f) return null;
    s = f(s);
    v++;
    s.version = v;
  }
  const g = s as unknown as GameState;
  if (typeof g.day !== 'number' || typeof g.money !== 'number' || !Array.isArray(g.staff)) return null;
  return g;
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** 정비 시간 상태만 저장한다 (영업 중 상태는 저장하지 않음) */
export function save(s: GameState): void {
  const st = storage();
  if (!st || s.dayState) return;
  try { st.setItem(SAVE_KEY, JSON.stringify({ ...s, dayState: null })); } catch { /* 저장 공간 없음: 무시 */ }
}

export function load(): GameState | null {
  const st = storage();
  if (!st) return null;
  try {
    const txt = st.getItem(SAVE_KEY);
    if (!txt) return null;
    const g = migrate(JSON.parse(txt) as AnySave);
    if (!g) return null;
    if (g.phase !== 'prep' && g.phase !== 'ended') g.phase = 'prep';
    g.dayState = null;
    return g;
  } catch { return null; }
}

export function clearSave(): void {
  try { storage()?.removeItem(SAVE_KEY); } catch { /* 무시 */ }
}

export interface Prefs { muted: boolean }
export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(storage()?.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return { muted: !!p.muted };
  } catch { return { muted: false }; }
}
export function savePrefs(p: Prefs): void {
  try { storage()?.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* 무시 */ }
}
