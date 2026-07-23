# PROGRESS.md

## 현재 상태 (wrap-up이 갱신 — 이 블록만 세션 시작 시 읽힘)
- 오늘의 목표: wama(학원 학생 관리) 킥오프→첫 화면 구현. **달성**
- 완료: 킷을 projects/<이름>/ 구조로 개편 + design/BEFORE_UI 게이트 신설 / PLAN·DECISIONS 작성 / auth-isolation 스펙(설계승인, status:draft) / 디자인 국면(projects/wama/design-rules.md approved + tokens.css) / 학원생 목록 화면 구현 + ui-reviewer 반영 — 게이트 green
- 멈춘 지점: 목록 화면 1사이클 완료. 데이터는 목업 fixture(entities/student/repo.ts — Supabase로 교체 대기). DB 파킹: projects/wama/supabase/migrations/0001_init.sql 작성됐으나 미적용
- 다음 할 일: 남은 화면을 fixture 위에 구현(디자인 우선) — 학생 상세·등록/수정·평가/점수 입력(빠른 경로) → 인증·통계는 새 시각 표면(가벼운 시안 checkpoint). 데이터 계층(DB 재개·0001_init.sql exam_score 추가·low 3건)은 화면 국면 이후.
- 대기 중인 결정: 없음 (스펙 approved 전환은 DB+INV 테스트 착수 시)

---
## 로그 (append-only — 필요할 때만 검색)

### 2026-07-21
- 예제(funding) 프로젝트 삭제 → 킷을 멀티 프로젝트 구조(projects/<이름>/)로 개편: gates(run-gates·spec-coverage)·scaffold(package.json·vite.config 생성 포함)·rules·스킬·에이전트 경로 일괄 갱신. 디자인도 프로젝트별(projects/<이름>/design-rules.md·mockups/).
- retro: "스테이지를 사용자 동의 없이 진행" 실패 → 아티팩트 의존 게이트 `design/BEFORE_UI` 신설(UI 레이어 작업은 승인된 design-rules.md 전제). LESSONS.md 반영은 사용자 몫으로 제안.
- wama: kickoff→PLAN, setup(supabase.md·security-reviewer를 학원격리 기준으로 정정), /spec auth-isolation(INV-A1~A8, 설계승인), DB SQL 작성(security-reviewer 통과, low 4건) — DB는 디자인 우선 원칙에 따라 파킹.
- 평가 이원화 결정: 월간 서술 평가 + 시험별 점수 이력(exam_score, 신규) 둘 다. 통계 페이지 선택→필수 승격.
- 디자인 국면: 학원생 목록 시안 승인(대기뱃지 회색·나이 제거) → design-rules approved + tokens.css. 시각언어: 신뢰+친근, 틸(#0d9488) 단일 강조, 라이트, 표 중심.
- 구현: 학원생 목록 화면 FSD 구현(vanilla TS+Vite, fixture 10명). ui-reviewer 반영 — 대비(brand-strong #0f766e 도입, 사용자 승인)·포커스 링·본문 16px·완료율 계산 위치(entities)·토큰화. 게이트 green. (spacing 토큰 스케일 도입은 보류)
- 검증 메모: Vite 서빙·모듈 변환 확인. 브라우저 자동 스크린샷은 이 환경에서 Chrome이 로컬 서버(127.0.0.1) 접근 실패 — 앱 결함 아님, 수동 확인 필요.
