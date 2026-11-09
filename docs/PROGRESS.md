# 진행 기록 (PROGRESS)

## 현재 상태
- 마지막 완료 단계: 0
- 다음 단계: 1

## 0단계 — 환경 점검
**범위:** `.gitignore`, `docs/PROGRESS.md`, git 저장소 초기화. 코드 파일 없음.
- Node v24.16.0 / npm 11.13.0 / git 2.54.0 / Python 3.12.10 확인.
- `gh auth status`: ovencub 계정 로그인됨(scopes: repo, workflow) → 9단계에서 멈출 필요 없음.
- `python tools/progression_model.py` 기준 결과: 평균(1.3) 20일 55분 / 2.0 20일 55분 / 1.0 22일 60분 / 0.9 23일 62분 — GDD 11.1 표와 일치.

## 결정 로그
| 단계 | 결정 | 이유 |
|---|---|---|
| 1 | three 최신(0.187)에서 `ColorManagement.enabled=false` + 선형 출력 + 조명 세기 ×π | 레퍼런스(r128 레거시 조명)와 같은 밝기·색 인상. 캔버스 텍스처도 색 변환 없이 그대로 |
| 1 | 모델링 치수·색(고양이 구 반지름 등)은 render/models 안에 둔다 | 레퍼런스 코드 이식. 게임플레이 수치(가격·시간·확률·비용·조건·레이아웃 좌표·고양이 크기 기준)는 전부 src/data |
| 1 | 1단계 2인석을 (-1.75,-0.85) → (-1.35,-1.0) 으로 이동 | 레퍼런스 좌표 그대로면 2인석 뒤 좌석·3번 테이블 뒤 좌석에 들어갈 길이 없음(검증기). 다른 테이블은 레퍼런스 좌표 그대로 |
| 1 | A* 격자 0.5 → 0.125칸 | 0.5칸 격자는 폭 0.1~0.2칸짜리 실제 통로를 놓쳐 "길 없음"이 됨. 장애물 팽창은 거리 계산으로 정확히 |
| 1 | 가게 확장은 왼쪽 벽을 1칸씩 밀고(주방 화구 칸 +1) 앞쪽으로 깊어진다. 화구 칸 수 = 3/4/5/6 (가게 단계별) | 레퍼런스 주방에 화구 3칸(2개+빈칸)만 들어가고, 화구 간격 1칸이 44px 탭 영역의 최소. 진행 모델 PLAN의 구매 순서(화구 4·5·6개째는 각각 확장 2·3·4단계 뒤)와 일치 |
| 1 | 카메라 최소 배율 44px/칸. 그보다 작아져야 다 보이면 주방이 보이게 맞추고 드래그·핀치 | CLAUDE.md "탭 대상 최소 44px" 우선 |

## 알려진 문제
(없음)

## 1단계 — 프로젝트 뼈대 + 정적 가게
**범위:** `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/main.ts`, `src/data/*`(레이아웃·팔레트 포함), `src/render/{toon,canvas2d,sprites,camera,renderer}.ts`, `src/render/models/{cat,bowl,shop,props}.ts`, `src/ui/{hud.ts,styles.css}`, `tools/shoot-reference.ts`, `e2e/phase1.spec.ts`. sim은 건드리지 않음.
- 의존성(정확한 버전 고정): three 0.187.0, vite 8.3.7, typescript 7.0.2, vitest 5.1.0, @playwright/test 1.65.0, tsx 4.23.15.
- 레퍼런스 스크린샷 `docs/shots/00-reference.png` 저장(390×844, 폰 프레임 영역, DPR 2).
- 레퍼런스 함수 이식: `render/toon.ts`(rbox·smoothNormals·M·olMat·blob), `render/canvas2d.ts`(drawDish·bubble·gauge·coin·textPop), `render/models/{cat,bowl,props,shop}.ts`(makeCat·makeBowl·테이블·화구·가게).
- 레이아웃: `src/sim/geometry.ts` 가 ART 8.2 규칙으로 좌석·그릇·진입점·서비스 지점·충돌 상자를 계산. `src/sim/layoutCheck.ts`(+`tools/layout-check.ts`)가 4단계 레이아웃 모두 "다른 좌석이 전부 찬 상태에서도 모든 좌석에 들어갈 길이 있고, 앉은 고양이(몸·발·꼬리)가 아무것도 뚫지 않음"을 검증 → 4단계 모두 OK.
- 스크린샷: `docs/shots/01-static-390x844.png`, `01-static-1440x900.png`. 레퍼런스와 나란히 비교 — 외곽선·툰 3단·팔레트·카메라 각도 동일 인상. PC는 가운데 480px 세로 캔버스.
- 결과: build 통과, e2e phase1 통과.
