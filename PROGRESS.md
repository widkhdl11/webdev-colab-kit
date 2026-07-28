# PROGRESS.md

## 현재 상태 (wrap-up이 갱신 — 이 블록만 세션 시작 시 읽힘)
- 오늘의 목표: 데이터 계층 착수(auth-isolation) + 시험성적 모델 교정 + retro. **전부 달성.**
- 완료: 시험성적 모델 교정(시험→과목 1:N·시험단위 요약·rowspan 그룹표) / **auth-isolation 데이터 계층 완결**: Supabase
  wama(ref zubdbqlrcuywvelvnfle) 프로비저닝·마이그레이션 0001~0004·클라이언트 배선(features/auth·인증3화면 실동작·세션가드·
  로그아웃)·리뷰어 3종(보안 HIGH search_path pg_temp 섀도잉→0004)·**INV-A1~A8 통합테스트 green→스펙 approved** / retro 4건
  (A definer-search_path 게이트린트·B scaffold skipLibCheck·C 통합테스트분리 tdd.md·D protect-files Bash차단). 필수 2/8.
- 멈춘 지점: auth-isolation·retro 완결. 미구현: 통계 페이지(pages/stats, 시안 승인됨) / student·schedule·evaluation·
  exam_score CRUD는 목업 repo(Supabase 미연결). autoconfirm은 대시보드에서 OFF(연습용).
- 다음 할 일: 통계 페이지 구현(승인 시안 stats.html → pages/stats: 3탭·꺾은선/막대·드릴다운); 그다음 학생·시간표·평가
  CRUD를 Supabase에 배선(각 스펙 먼저: 재원상태·삭제보존·평가완료-시변·학생과목1:N·교차테이블무결성).
- 대기 중인 결정: 없음. (이월: 교차테이블 학원무결성 PLAN🟡 · exam_score 테이블 0005)

---
## 로그 (append-only — 필요할 때만 검색)

### 2026-07-25
- exam-score 모델 교정: ExamScore(평평) → Exam(부모)+SubjectScore(자식), summarizeScores 시험단위 재작성(examAvgPct),
  exam-score-table rowspan 그룹표. code+ui 리뷰 반영(max=0 방어·"횟수"=전체시험수 통일·빈시험 "—").
- auth-isolation 데이터 계층: Supabase Management API(curl+루트.env SUPABASE_TOKEN)로 wama 생성(ref zubdbqlrcuywvelvnfle,
  서울). 마이그레이션 0001(스키마·RLS·RPC)·0002(academy branch/phone)·0003(gen_random_uuid — gen_random_bytes가
  extensions 스키마라 런타임 실패)·0004(search_path='' + 스키마한정 — pg_temp 섀도잉 취약점, 익스플로잇 실증 후 수정).
  클라이언트: shared/api/supabase·shared/lib/result·entities/academy(parseAcademy 경계파싱)·features/auth·인증3화면
  실배선·main.ts 세션가드·헤더 로그아웃. danger 토큰 checkpoint 추인(design-rules+auth.html 오류프레임).
- 검증: 행동 검증(롤백 SQL로 A1~A8) + 커밋 통합테스트(tests/inv, autoconfirm OFF 후 두 학원 세션 9 green).
  통합테스트는 게이트에서 분리(vitest.integration.config·test:integration, 게이트 오프라인 결정론 유지). 스펙 draft→approved.
- 리뷰어 3종: code(getMyAcademy 3-state Result·세션캐싱·translate·fieldValue/formNote/withPending 공용화)·
  security(HIGH search_path 실증→0004)·ui(라이브리전 :empty 상주·error=alert/info=status·헤더 aria-label).
  발견 2건(gen_random_bytes 런타임실패·격리우회) 다 행동검증이 잡음 — 구조검증은 놓침.
- retro 4건 반영: A(gates definer search_path 린트, 마지막정의 판정)·B(scaffold skipLibCheck)·C(tdd.md 통합테스트 분리
  +tests/** 경로)·D(protect-files.mjs+settings.json — Bash 우회 구멍 차단, 9케이스 검증). A·D는 보호파일이라 사용자 반영.

### 2026-07-24
- 화면 대량 구현(fixture, 빠른 경로): 학생 상세(시간표·시험성적·월간평가·수강과목 + 정보수정·평가표 내보내기 버튼) / 등록·수정 폼 / 평가·점수 입력(점수는 정기=년도·학기·비정기=시험명·시기 전환 + 과목별 다행 입력) / 평가·점수 수정 모드 / 인증 3화면 / 시간표 관리(요일 다중 체크박스) / 과목 관리. 얇은 해시 라우터(shared/lib/router)·공유 폼 프리미티브(shared/lib/form) 재사용.
- 새 시각 표면 2종 시안 국면(design-drafter→checkpoint→design-rules 기록): 인증(400px 카드·탭 세그먼트·중앙 브랜드·focus 글로우) / 통계(dataviz — 반복 수정 후 승인: 3탭[전체·과목별·학년별]·2년 9시점 꺾은선·area·드릴다운 순위표+네비). 통계는 pages/stats 실동작 미구현.
- 모델 교정(설계단계 catch): 나이·학년=생년월일 파생(offset, 유급/빠른년생), 학생↔과목 1:N(과목=시간표 파생, 등록폼서 제거), 월간평가 년.월 묶기, 시험 정기(중간·기말=년+학기)/비정기(학원·모의=이름+시기)·시험명 조건부·통계 정기만·학원모의 나중, 통계 평균정의(학생별 평균의 평균), 요일 다중. 전부 PLAN 모델링 플래그+DECISIONS에 박음.
- 하네스 업그레이드(retro 종류 필터 신설): modeling-checklist.md(도메인무관 9항목, INV 예시·권장패턴)+kickoff(얕게 플래그)·/spec(깊게 INV)·CLAUDE 위험목록 라우팅 / retro 빈도→종류 판별(구조적빈칸 1회라도 vs 판단실수) / harness-backlog.md(+retro 스캔+briefing 리마인더) / spacing 토큰(--space-*)+짝수 규칙(짝수 게이트 제안=미반영) / briefing 순서가드(DB-먼저 경보) / 여백 정규화·[hidden] 리셋.
- ui-reviewer 반영: 상세·등록·평가/점수·인증 각 화면 리뷰 후 수정(label-for·focus링·틸 절제·토큰·시안 일치). 검증: 매 편집 tsc/게이트 green(29파일), vite build 성공. 브라우저 자동 스크린샷 불가 환경(사용자 수동 확인).

### 2026-07-21
- 예제(funding) 프로젝트 삭제 → 킷을 멀티 프로젝트 구조(projects/<이름>/)로 개편: gates(run-gates·spec-coverage)·scaffold(package.json·vite.config 생성 포함)·rules·스킬·에이전트 경로 일괄 갱신. 디자인도 프로젝트별(projects/<이름>/design-rules.md·mockups/).
- retro: "스테이지를 사용자 동의 없이 진행" 실패 → 아티팩트 의존 게이트 `design/BEFORE_UI` 신설(UI 레이어 작업은 승인된 design-rules.md 전제). LESSONS.md 반영은 사용자 몫으로 제안.
- wama: kickoff→PLAN, setup(supabase.md·security-reviewer를 학원격리 기준으로 정정), /spec auth-isolation(INV-A1~A8, 설계승인), DB SQL 작성(security-reviewer 통과, low 4건) — DB는 디자인 우선 원칙에 따라 파킹.
- 평가 이원화 결정: 월간 서술 평가 + 시험별 점수 이력(exam_score, 신규) 둘 다. 통계 페이지 선택→필수 승격.
- 디자인 국면: 학원생 목록 시안 승인(대기뱃지 회색·나이 제거) → design-rules approved + tokens.css. 시각언어: 신뢰+친근, 틸(#0d9488) 단일 강조, 라이트, 표 중심.
- 구현: 학원생 목록 화면 FSD 구현(vanilla TS+Vite, fixture 10명). ui-reviewer 반영 — 대비(brand-strong #0f766e 도입, 사용자 승인)·포커스 링·본문 16px·완료율 계산 위치(entities)·토큰화. 게이트 green. (spacing 토큰 스케일 도입은 보류)
- 검증 메모: Vite 서빙·모듈 변환 확인. 브라우저 자동 스크린샷은 이 환경에서 Chrome이 로컬 서버(127.0.0.1) 접근 실패 — 앱 결함 아님, 수동 확인 필요.
