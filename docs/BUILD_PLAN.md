# 개발 단계 계획

각 단계는 **완료 기준을 전부 통과**해야 다음 단계로 넘어간다. 단계를 마칠 때마다:
1. `npm run build` 와 `npm test` 통과
2. 해당 단계 스크린샷을 `docs/shots/` 에 저장하고 직접 열어 보고 레퍼런스와 비교
3. `docs/PROGRESS.md` 에 한 일·결정·남은 문제 기록
4. git 커밋 (`feat(phaseN): ...`)

---

## 0단계 — 환경 점검
- Node 20 이상, npm, git 확인. 없으면 멈추고 설치 안내를 보고.
- `gh auth status` 확인. 로그인 안 돼 있으면 **멈추지 말고** PROGRESS에 "배포 전 gh auth login 필요"로 적고 계속 진행(9단계에서 다시 확인).
- `git init`, `.gitignore`(node_modules, dist, test-results, playwright-report).
- 완료 기준: PROGRESS.md 생성, 첫 커밋.

## 1단계 — 프로젝트 뼈대 + 정적 가게
- Vite + TypeScript(strict) + three(npm, 설치 시점 최신 안정판을 package.json에 정확한 버전으로 고정) + Vitest + Playwright(chromium).
- 폴더 구조
```
src/
  main.ts
  data/      menus.ts staff.ts facilities.ts research.ts promos.ts tiers.ts balance.ts layouts.ts
  sim/       rng.ts state.ts sim.ts customers.ts kitchen.ts review.ts economy.ts staffAI.ts grid.ts commands.ts
  render/    renderer.ts camera.ts toon.ts sprites.ts fx.ts models/{cat,bowl,shop,props}.ts views/{tableView,burnerView,...}.ts
  input/     picker.ts drag.ts
  ui/        hud.ts settlement.ts prep/{staff,facility,menu,research,promo}.ts toast.ts tutorial.ts share.ts tier.ts styles.css
  audio/     sfx.ts bgm.ts
  save/      storage.ts
tests/       *.test.ts (시뮬레이션 규칙)
e2e/         *.spec.ts (Playwright)
tools/       sim.ts progression_model.py
```
- `design/style-preview.html` 의 모델링·스프라이트 함수를 `render/` 로 이식. 1단계 가게 레이아웃은 레퍼런스와 같은 좌표(`data/layouts.ts`).
- 먼저 `design/style-preview.html` 을 Playwright로 390×844에서 열어 `docs/shots/00-reference.png` 로 저장(폰 프레임 영역만). 이후 모든 비교의 기준.
- 정적 장면(고양이 몇 마리 배치) + HUD 껍데기.
- 완료 기준: 390×844 세로 스크린샷이 레퍼런스와 같은 인상(외곽선, 툰 셰이딩, 색, 카메라 각도). PC 1440×900에서 가운데 세로 캔버스.

## 2단계 — 시뮬레이션 코어 (렌더링 없음)
- `src/sim/` 은 three·DOM을 import하지 않는 순수 TypeScript. 고정 스텝 30Hz, 시드 RNG, 상태는 직렬화 가능한 평범한 객체.
- 플레이어 행동은 명령으로만 들어온다: `takeOrder(tableId)`, `startCook(burnerId, menuId)`, `collect(burnerId)`, `serve(passSlotId, tableId?)`, `clean(tableId)`, `wash()`.
- 이벤트 큐로 렌더러에 알림: `customerArrived`, `seated`, `orderTaken`, `cookDone`, `burned`, `served`, `ateUp`, `angryLeave`, `paid`, `review` 등.
- GDD 4~5장 규칙 전부 구현.
- 완료 기준(단위 테스트, 최소 30개): 팀 크기 상한, 가장 작은 테이블 배정, 웨이팅 6팀 상한·인내심 공식, 그릇 0개 조리 불가, 3초 후 탐, 배식대 꽉 참, 가장 오래 기다린 테이블로 서빙, 인내심 50/80/100% 상태 전이, 개수대 꽉 차면 청소 불가, 리뷰 공식(시작값 0.6~1.2 분포 확인, 1만 샘플 평균이 Q±0.05), 최근 50건 평균, 맛 레벨 3가지 경우, 가격 맛 프리미엄.

## 3단계 — 플레이 가능한 하루
- 렌더러가 매 프레임 sim 상태를 읽어 3D에 반영(보간). 손님 걷기, 착석, 말풍선, 화구 링, 배식대, 날아가는 국밥, 동전, 개수대 높이.
- 입력: 레이캐스트용 **투명 히트박스**(실제 모델보다 크게, 화면상 최소 44px). 탭/드래그 판정 거리 8px.
- 화구 메뉴 선택 팝업(원형 버튼, 대기 주문 수 배지).
- HUD 실시간 갱신. 일시정지.
- 레이아웃 데이터에서 좌석·그릇 위치·통로를 ART.md 8장 규칙으로 **계산**한다(좌표 하드코딩 금지).
- `?debug=overlap` 겹침 검사기 이식.
- 완료 기준: Playwright e2e가 정해진 시드로 하루를 탭으로 진행해 최소 1그릇 판매·수금·설거지까지 확인. 같은 실행에서 관통 0.02칸 초과 0건. 모바일 스크린샷 3장(바쁜 순간, 완료 알림, 화난 손님).

## 4단계 — 경제, 정산, 정비 시간, 저장
- 정산 영수증 연출(GDD 12장), 정비 화면 5탭, 구매·고용·해고, 조건 미충족 항목은 잠금 이유 표시.
- 티어 판정과 축하 연출, 가게 확장(레이아웃 2~4단계, 벽이 밀려나는 트윈, 카메라 재맞춤 + 드래그/핀치).
- 저장: localStorage `guckbob.save.v1`, 버전 필드와 마이그레이션 자리. 시작 화면에 "이어하기 / 새로 시작".
- 완료 기준: e2e로 1일 진행 → 정산 → 화구 구매 → 새로고침 → 이어하기 후 화구 3개 확인.

## 5단계 — 직원 AI
- 바닥 그리드 경로 탐색(A*, 테이블·카운터는 막힘). 주방장은 주방 구역, 서버는 홀, 설거지 알바는 개수대 고정.
- GDD 6장 우선순위·속도·운반량·절대 안 타는 주방장 조리.
- 고양이끼리 분리 조향, 장애물 팽창 그리드(ART.md 8.3).
- 완료 기준: 단위 테스트(주방장 2화구 상한, 서버 우선순위, 개수대 꽉 참 시 서버가 청소 안 함) + 직원 풀세트·가게 4단계 상태로 1일 e2e를 돌려 관통 0건 + 스크린샷.

## 6단계 — 밸런스 봇 검증
- (2026-11-10 변경) 기준 봇은 **사람 흉내 봇** `--human`(집중 약 80%, 반응 0.7초, 25% 확률로 가장 급한 일을 놓침). 완벽 봇은 참고용. 근거 `docs/BALANCE_LOG.md` (5)(6).
- `npm run sim -- --days 40 --seeds 5 --tap 1.3`: 헤드리스로 sim을 돌린다. 봇 플레이어는 `--tap` 값만큼 **초당 행동 수** 제한, 반응 지연 0.4초, 가장 급한 일부터(완료 알림 > 서빙 > 주문 > 청소 > 설거지 > 조리). 정비 시간 구매 전략은 `tools/progression_model.py` 의 PLAN 순서와 같게(TV 출연 안 삼, 귀빈은 별점 4.5 이상일 때, 실패하면 재도전).
- 플레이 시간 = 일수 × (영업 120초 + 실제 UI 연출 시간 합 + 정비 15초 + 구매당 4초). UI 연출 시간은 코드의 data 값에서 계산한다.
- 목표(5시드 중앙값):
  | 봇 | 미슐랭 도달일 | 누적 플레이 시간 |
  |---|---|---|
  | 탭 1.3/초 (평균 유저) | 19~23일 | **52~65분** |
  | 탭 0.9/초 (느린 유저) | 30일 이내 | 80분 이내 |
  | 탭 2.0/초 (숙련 유저) | 평균보다 같거나 빠름 | 45분 이상 |
  그리고 1일차 순이익 양수, 평균 봇 1일차 화난 손님 3팀 이하(첫날부터 포기하지 않게), 평균 봇 10일차 이후 피크 시간 웨이팅 줄 발생(정신없게).
- 진행 모델 표(GDD 11.1)와 봇 결과를 나란히 비교해 차이가 크면 원인(모델 가정 vs 구현)을 BALANCE_LOG에 쓴다.
- 벗어나면 `src/data/` 수치만 조정하고 변경 전후를 `docs/BALANCE_LOG.md` 에 표로 기록. GDD와 달라진 수치는 GDD에도 반영.
- 완료 기준: 리포트(`docs/balance-report.md`)에 시드별 티어 도달일, 일별 매출·순익·별점 표.

## 7단계 — 손맛, 사운드, 튜토리얼, 공유
- 연출: GDD 15장 속도 원칙 그대로. 탭 눌림, 숫자 팝업, 국밥 포물선, 동전 흡수 → HUD 카운트업, 콤보 텍스트, 티어 업 색종이, 화면 흔들림은 탐·화난 손님에만 약하게.
- **엔딩과 결과 페이지(GDD 13장)**: 엔딩 연출, 결과 페이지, 결과 카드 이미지, `?r=` 도전장 링크와 도전장 첫 화면, 플레이 시간 측정(일시정지·백그라운드 제외).
- 사운드 GDD 15장. 튜토리얼 GDD 14장. 공유 카드·OG 이미지 GDD 13장(OG 이미지는 Playwright로 게임 장면을 찍어 1200×630으로 생성).
- 완료 기준: 튜토리얼 e2e, `?debug=1` 치트로 미슐랭 직전 상태를 만들어 엔딩 → 결과 페이지 → 공유 링크 생성 → 그 링크로 새 창을 열어 도전장 화면이 뜨는지 e2e. 잘못된 `?r=` 값(깨진 base64, 긴 이름, 범위 밖 숫자)은 무시하고 일반 시작 화면.

## 8단계 — 모바일 품질
- 세이프 에어리어, 회전 시 세로 고정 안내, 더블탭 확대·스크롤 튕김 방지(`touch-action`, `overscroll-behavior`).
- 성능: 5초 평균 fps < 40 이면 픽셀 비율 1로 낮춤. 손님 최대 수에서 드로우콜 측정 기록.
- 탭이 안 먹는 곳이 없는지 e2e로 모든 상호작용 대상 클릭 테스트.
- 완료 기준: 390×844, 360×780, 430×932, 1440×900 스크린샷 + 성능 기록.

## 9단계 — 배포
- `vite.config.ts` 의 `base: './'`.
- `.github/workflows/deploy.yml`: push(main) 시 빌드 → GitHub Pages 배포 (configure-pages, upload-pages-artifact, deploy-pages).
- `gh auth status` 확인 → `gh repo create ovencub/guckbob --public --source . --push` → Pages 소스를 GitHub Actions로 설정(`gh api`).
- 배포 완료 후 `https://ovencub.github.io/guckbob/` 를 Playwright로 열어 캔버스 렌더링·콘솔 에러 없음 확인.
- `README.md`: 게임 소개 한 줄, 플레이 링크, 조작법, 개발 방식.
- gh 로그인이 안 돼 있으면 여기서 **멈추고** 사용자에게 `gh auth login` 을 요청한다.

## 10단계 — 최종 점검
- `docs/QA_CHECKLIST.md` 를 만들어 전부 체크: GDD의 모든 규칙이 게임에 있다 / 모든 수치가 data 테이블에 있다 / 콘솔 에러 0 / 관통 0 / 새로 시작·이어하기 / 미슐랭 엔딩·결과 페이지·도전장 링크(디버그 치트 `?debug=1`, 배포본에서는 숨김) / 음소거 저장 / 공유 / 평균 봇 플레이 시간 52~65분.
- 마지막 보고: 플레이 링크, 단계별 요약, 봇 밸런스 결과(미슐랭 도달일·플레이 시간), 알려진 문제.
