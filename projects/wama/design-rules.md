---
status: approved
---
# wama 디자인 기준
checkpoint 승인: 2026-07-21 · 대표 화면: 학원생 목록 (projects/wama/mockups/student-list.html)

이 문서는 승인된 시각 언어의 단일 진실. UI 구현은 이걸 근거로 하고, 게이트(design/BEFORE_UI)가
이 파일의 status: approved 를 확인해 pages/widgets 작업을 허용한다. 방향을 바꾸려면 checkpoint 재승인.

## 시각 언어
- 무드: **신뢰 기반 + 약간 친근** (차분·정돈된 실무 도구, 딱딱하지 않게)
- 밀도: 정보 밀집(표 중심) / 톤: 라이트 / 반응형: **데스크톱 우선** (중앙 정렬 max-width 1120px)
- 모서리: 살짝 라운드 **8px** / 그림자: 얇게
- 폰트: **Pretendard** → system-ui fallback. 숫자 열(나이/점수/평가월/카운트)은 `tabular-nums`

## 색 — 단일 강조 (색 절제)
- **강조(brand)**: `#0D9488` (hover `#0B8177`) — **비텍스트 강조만**: 행 hover 배경·진행률 바·포커스 링·인풋 focus 보더.
- **텍스트 강조면(brand-strong)**: `#0F766E` (hover `#115E59`) — 흰 텍스트가 얹히거나 텍스트로 쓰는 강조: CTA 버튼·활성 페이지·완료 뱃지 텍스트·이름 hover. WCAG 4.5:1 확보(2026-07-21 checkpoint 승인).
- 강조 연배경(brand-soft): `#f0fdfa` / 강조 보더(brand-border): `#99f6e4`
- 배경: 페이지 `#f8fafc`, 카드/표 `#ffffff`
- 텍스트: 본문 `#1e293b`(ink), 보조 `#64748b`(muted) / 보더 `#e2e8f0`(line)
- **상태색은 강조색 하나만 유지**: 완료=brand(brand-soft 배경), 대기=회색(slate-100/slate-600).
  (amber 등 두 번째 의미색은 도입하지 않음 — checkpoint 결정)

## 컴포넌트 규약
- **표**: 헤더 `slate-50` 배경·uppercase 소형, 행 hover=`brand-soft`, 이름=링크(hover 강조색+밑줄),
  행 전체 클릭→상세(cursor-pointer). 개인정보 최소 노출 — **나이는 표에 노출하지 않고 학년만**.
- **버튼 CTA**: `bg-brand` / hover `brand-hover` / 흰 텍스트 / rounded 8px / 얇은 그림자.
- **보조 버튼(ghost)**: 비주요 액션(취소·정보 수정 등). 흰 배경·line 보더·본문색 텍스트, hover 시 연회색 배경. 강조색 안 씀(틸은 주요 액션에 예약).
- **뱃지**: rounded-full, 완료=brand-soft+brand, 대기=slate-100+slate-600.
- **입력/셀렉트**: 흰 배경·line 보더, focus 시 brand 보더.
- **접근성**: 본문 16px 이상, 대비 4.5:1 이상, 포커스 링 강조색(**제거 금지**), 인풋 label 연결,
  표 caption/scope, 진행률 role=progressbar.

## 토큰
`projects/wama/src/shared/ui/tokens.css` 의 CSS 변수와 동기화한다. 하드코딩 색/간격 금지 — 토큰 사용.

## 이 화면에서 확정된 것 (반복 화면은 빠른 경로)
- 헤더(로고+학원명 / 내 계정) · 요약 지표 3장 · 검색+필터+등록 CTA · 학생 표 · 페이지네이션
- 상세·입력·등록 폼은 이 언어의 반복 → checkpoint 불필요(빠른 경로).
- **통계 페이지(차트)** 는 새 시각 표면 → 별도 checkpoint에서 이 언어 위에 확장(dataviz).
