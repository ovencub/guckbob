// 정비 화면 "추천" 판단 기준 (어제 기록 기준)
export const RECOMMEND = {
  burntForChef: 2,       // 탄 국밥 수
  queueBusy: 3,          // 웨이팅 최대 팀 수
  angryForServer: 1,     // 화난 팀 수
  sinkTroubleSec: 10,    // 개수대 꽉 참 + 그릇 0 시간
  bowlZeroSec: 4,        // 그릇 0 시간
  promoMoneyShare: 0.35, // 가진 돈의 이 비율 이하 홍보만 추천
} as const;
