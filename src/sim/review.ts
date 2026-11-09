// 리뷰 점수와 가게 별점 (GDD 5.3, 5.4)
import { REVIEW, TASTE } from '../data/balance';
import { rand, randRange, triangular, type RngHost } from './rng';

export function speedFactor(p: number): number {
  if (p <= REVIEW.fastRatio) return 1;
  const k = Math.min(1, (p - REVIEW.fastRatio) / (1 - REVIEW.fastRatio));
  return 1 - (1 - REVIEW.slowFloor) * k;
}

export function reviewCap(T: number, K: number): number {
  return REVIEW.capBase + REVIEW.capRange * (REVIEW.tasteWeight * (T - 1) / (TASTE.max - 1) + REVIEW.kindWeight * K / TASTE.kindMax);
}

export const reviewExpected = (T: number, K: number, p: number): number => reviewCap(T, K) * speedFactor(p);

/** 리뷰 한 건 샘플링: 80% Q+삼각(±0.3), 20% Q±균등(0.4~0.9). clamp 후 소수 첫째 자리 */
export function sampleReview(h: RngHost, T: number, K: number, p: number): number {
  const Q = reviewExpected(T, K, p);
  let v: number;
  if (rand(h) < REVIEW.normalShare) v = Q + triangular(h, REVIEW.triHalf);
  else v = Q + (rand(h) < 0.5 ? -1 : 1) * randRange(h, REVIEW.extremeMin, REVIEW.extremeMax);
  v = Math.max(0, Math.min(REVIEW.maxStars, v));
  return Math.round(v * 10) / 10;
}

/** 최근 50건 창에 리뷰를 넣는다 (귀빈은 10건) */
export function pushReview(list: number[], score: number, weight = 1): void {
  for (let i = 0; i < weight; i++) list.push(score);
  while (list.length > REVIEW.window) list.shift();
}
