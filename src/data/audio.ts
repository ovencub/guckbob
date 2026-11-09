// 사운드 (GDD 17장): 파일 없이 WebAudio 로 즉석 합성
export const AUDIO = {
  master: 0.5,
  sfx: 0.55,
  bgm: 0.16,
  bpm: 150,
  rushBpm: 180,           // 마감 10초 전
  scale: [0, 2, 4, 7, 9] as readonly number[], // 5음계
  root: 60,               // C4 (MIDI)
  comboStep: 2,           // 콤보마다 반음 2개씩
  comboMax: 10,
} as const;
