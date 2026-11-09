// 시드 RNG (mulberry32). 상태는 숫자 하나라 저장이 쉽다.
export interface RngHost { rng: number }

export function rand(h: RngHost): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randInt = (h: RngHost, n: number): number => Math.floor(rand(h) * n);
export const randRange = (h: RngHost, a: number, b: number): number => a + (b - a) * rand(h);

export function weighted<T>(h: RngHost, items: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rand(h) * total;
  for (const [v, w] of items) {
    r -= w;
    if (r < 0) return v;
  }
  return items[items.length - 1][0];
}

/** 삼각분포 (-half ~ +half, 0에서 최빈) */
export const triangular = (h: RngHost, half: number): number => (rand(h) + rand(h) - 1) * half;
