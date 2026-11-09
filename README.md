# 고양이 국밥집 (GuckBob)

고양이 손님이 끝없이 몰려드는 작은 국밥집을 탭만으로 굴려 소상공인에서 미슐랭까지 키우는 3D 쿼터뷰 하이퍼캐주얼 타이쿤. 며칠 만에 미슐랭을 찍었는지 친구에게 자랑하세요.

**플레이:** https://ovencub.github.io/guckbob/

## 조작
- **테이블 탭**: "주문!" 받기 / 동전 뜬 테이블 수금·치우기
- **빈 화구 탭**: 국밥 끓이기 (메뉴가 여럿이면 원형 버튼에서 고르기)
- **"완료!" 화구 탭**: 배식대로 (3초 안에, 늦으면 타요)
- **배식대 국밥 탭**: 가장 오래 기다린 테이블로 날아감 · 끌어서 원하는 테이블에 놓기도 가능
- **개수대 탭**: 그릇 1개 설거지
- 정비 시간에 직원·시설·메뉴·연구·홍보에 투자 → "다음 영업하기"
- 가게가 커지면 드래그로 이동, 핀치(휠)로 확대

## 개발
Vite · TypeScript(strict) · three · Vitest · Playwright. 외부 모델·이미지·사운드 파일 없이 전부 코드로 만든다.
```
npm install
npm run dev      # 개발 서버
npm test         # 시뮬레이션 단위 테스트
npm run e2e      # Playwright (겹침 검사 포함)
npm run sim -- --days 40 --seeds 5 --tap 1.3   # 밸런스 봇
```
기획 `docs/GDD.md` · 아트 `docs/ART.md` · 진행 기록 `docs/PROGRESS.md` · 밸런스 `docs/BALANCE_LOG.md`, `docs/balance-report.md`.
Claude Code가 BUILD_PLAN 단계대로 자동 진행해 만들었다.
