# PROGRESS.md

## 현재 상태 (wrap-up이 갱신 — 이 블록만 세션 시작 시 읽힘)
- 오늘의 목표: "월간 평가표 내보내기" 디자인 국면. **달성 + 기능 정체가 바뀜** — 실제 필요는 평가표가 아니라
  **학부모 전달용 시간표·결제 안내 이미지**였다(PRODUCT 필수기능 교체, 사용자 동의).
- 완료: 스펙 payment-notice-export.md **approved+봉인(INV-PN1~PN7)** · 시안 payment-notice.html 확정(checkpoint 4회) ·
  design-rules "학부모 전달용 출력물" 블록 신설·개정 · entities/tuition 순수 도메인 + 유닛 26 green ·
  횡단 미결 2건 소진(_cross-cutting 5→3) · 커밋 4개(kit 2 + wama 2, **푸시 안 함**).
  수강료 모델: 가격=(과목×주 횟수)→월정액, 주 횟수는 시간표 파생(저장 금지), 학생별 과목 예외로 할인.
- 멈춘 지점: 도메인만 만들고 멈춤. **마이그레이션 3종(과목 가격표 · 학생별 과목 예외 · 학원 계좌·기본문구) 미착수**,
  UI·repo 없음. INV-PN1 통합테스트는 그 테이블이 없어 **현재 red**(tests/inv/, 기본 npm test 밖이라 게이트는 통과).
- 다음 할 일: 학원 설정 화면(계좌·기본 문구) → 과목 가격표 → 학생별 예외 → 내보내기 화면 순으로 UI를 만든다.
  시각 기준은 승인된 design-rules "학부모 전달용 출력물" + mockups/payment-notice.html (**시안 재작업 불필요**).
- 대기 중인 결정: **wama 레포 푸시 여부(Vercel 자동배포 트리거)** · 이전 세션이 남긴 미커밋 파일 2개
  (src/entities/{exam-score,student}/model.test.ts) 처리. 그 외 스펙 4종(evaluation·exam-score·schedule·
  student-registration) 여전히 draft · 실배포 시 이메일확인 재활성 · schedule/evaluation student_id 학원검증 미적용.

---
## 로그 (append-only — 필요할 때만 검색)

### 2026-08-03~04 (평가표 → 수강료 안내 이미지로 교체 · 디자인 국면 → 스펙 승인 → 도메인)
- **기능 정체 변경**: design-interview 회차1 답변에서 "이미지는 학생 부모에게 보낼 시간표+결제금액"이 나옴.
  서술 평가는 내보내지 않는다(3회 명시). PRODUCT 필수기능·페이지 구성·비범위 갱신, 스펙 evaluation-export.md
  → payment-notice-export.md 개명. DECISIONS 2026-08-03 기록 + 옛 항목 2건에 `→ 번복됨` 표시(지우지 않음).
- **디자인 국면(checkpoint 4회)**: ①A/B/C 3안 비교 → C(블록+시간) 채택 ②금액 틸 채움 폐기(헤어라인 띠+틸 글자,
  72→62px)·입금 한 줄(은행│계좌│예금주, 계좌번호는 대비 우선 ink) ③시간표 2열 시도 → **철회**(열 머리를 잃는
  대가가 큼 — 지킬 것은 4:5가 아니라 표의 읽는 법) ④시간 열 제거 + 과목/요일 50%씩 중앙 정렬.
  캔버스가 "정확히 1080×1350"에서 **"폭 1080 고정·높이 가변(최소 1350)"** 으로 바뀜(6과목 1566 / 1과목 1350).
  시간 항목은 세 번 뒤집힘(F6 미표기 → C안 포함 → 최종 제거) — 경위와 우려를 시안·design-rules 주석에 보존.
- **스펙 인터뷰**: 수강료 계산이 핵심이었음. "총액 저장" 기각(과목 끊어도 금액이 안 따라감), "회당 단가×달력 회차"
  기각(4주/5주·공휴일 차감이 줄줄이 딸림). 사용자 확인 = **(과목×주 횟수)→월정액**, 4주인 달과 5주인 달 동일.
  가격표 없는 조합은 빈칸+생성 차단(0원 대체 금지), 할인은 학생별 과목 예외로. 일괄 내보내기는 선택 기능이되
  **모델은 일괄 가능하게** 설계. 봉인 inv_hash 9d49b089.
- **게이트가 두 번 붙잡음**: (1) 봉인 직후 spec-coverage MISSING_TEST 7건 → npm test도 함께 도므로 red로 종료 불가
  → 순수 도메인 최소 슬라이스로 TDD 한 사이클을 닫음(red 확인 → 구현 → green 26). (2) entities/tuition이
  schedule·student를 import해 fsd/CROSS_SLICE → **자족 슬라이스**로 전환(필요한 모양만 선언, 학년은 주입받음).
- 횡단 미결 소진: 돈 값 단위·신뢰(원 정수, 학생엔 총액 아닌 과목별 예외, 내보내기 수정은 저장 안 함) /
  전학 시 과거 학교(이력 없음, 항상 현재값). 결정은 student-registration에도 이관 기록.
- 검증: 게이트(44파일) green · 유닛 84 green · tsc green. 커밋 kit 2 + wama 2. **푸시 보류**(Vercel 배포 트리거).

### 2026-08-01 (성적 통계 페이지 — 스펙 → 구현 → 리뷰)
- /spec stats(인터뷰로 결정, 봉인 INV-ST1~ST4): 전체 탭 그래프=정기(중간·기말)만, 평균=학생별 평균의 평균(학생 동등 가중),
  점수=만점 대비 백분율 환산, 미응시=집계 제외(0 아님), 과목=저장 문자열 그대로(병합 안 함), 학년별=현재 학년 스냅샷, 격리=RLS.
  모의=개인 그래프 보조선(추후)·비정기(학원)=별도 영역(추후)로 비범위. 시간축은 기존 입력폼 연도·학기 select("YYYY 학기" period)로
  충분 → exam 스키마 무변경(초기 우려한 자유문자열 파싱 불필요 — 사용자 지적으로 정정).
- 구현: entities/stats(model 순수 집계 = FSD 자족 슬라이스, 타 엔티티 import 없음 / repo RLS 조회, gradeOf는 페이지가 student
  read-model에서 주입) · pages/stats(3탭·SVG 꺾은선/막대·드릴다운, shared에 svgEl 헬퍼) · 라우트 #/stats + 학생목록 네비 · tokens --radius-sm.
- 리뷰어 4종 반영: repo 결측 NaN 보존(Number(null)=0 → ST4 우회 차단), subjectTrend 미실시 시점 0위장→점 생략, 로드실패 Result로
  빈상태와 구분, 집계 단일 경로(academyAvgAtSite)로 통합 + 중복 학생행 방어 테스트(알리바이 제거), 드릴다운 이름 링크(키보드),
  탭 대비·곡선+area 그라데이션·값 라벨 12px, ST1 통합테스트를 실제 getAcademyExams 경로로 구동 + 양성 단언. 유닛 13→19.
- 횡단 미결: _cross-cutting.md에서 과목 분열·점수 단위(만점) stats 몫 소진(관련 목록에서 stats 제거, 다른 스펙 몫은 유지).
- 검증: tsc·게이트(40파일)·유닛 29 green, vite build 성공. 커밋 2개(docs 스펙 / feat 구현) struc-change 푸시.

### 2026-07-28 (데이터 계층 전면 Supabase 전환 + 배포)
- 출발: "과목 삭제/추가 저장 안 됨" 버그 → 조사 결과 앱 데이터 계층 대부분이 목업+저장없음이고 스키마가 도메인 모델과
  갈라진 상태(student.age↔birthDate, exam 테이블 부재) 확인. 통계 제외 전 기능 실동작화로 확장.
- 마이그레이션(scripts/apply-migrations.mjs = Management API로 실DB 적용): 0005 subject(테이블+RLS+기존학원 6과목 시드),
  0006 student age→birth_date+grade_offset·schedule teacher·academy_id default current_academy_id(), 0007 exam+exam_score
  1:N+RLS(자식은 부모 소속으로 격리)+원자적 RPC create/update_exam_with_scores(security invoker), 0008 exam RPC에 student
  소속 검증. 통합테스트 tests/inv에 subject·exam 격리 4건 추가 → 17 green.
- repo 5개 목업→Supabase. 규약: 읽기(list/get)=도메인타입+실패시 빈결과+console.error, 쓰기=Result+폼 에러표시.
  파생필드(학년=birthDate·수강과목=schedule distinct·평가상태) 다른표에서 배치쿼리로 계산. **평가완료=수강 전 과목이
  이번달 평가 완료**(기존 "아무거나 하나"에서 변경). 폼 4개 저장 배선, 편집 라우트에 :evalId/:examId 부여(위젯 editHrefFor).
- 리뷰어 3종(code·security·ui) 반영: 빈점수 0저장(NaN로), 평가 과목 조용한 재할당, 시간표 부분실패 중복, 보조쿼리 로그.
- 버그수정: 시간표 과목드롭다운=학원과목 전체(수강과목 우선 아님), 요일당1행→같은과목 요일칩 묶음표시(삭제=묶음전체),
  평가 과목=수강과목 한정, 학생 삭제 UI(상세 두번눌러확정+CASCADE), tsconfig baseUrl 제거(TS5.9 폐기 에러), 세션기반 헤더.
- 배포: (1) CLI로 빌드 dist 직접 업로드(env가 번들에 구워짐 — Vercel env 불필요) → (2) **projects/wama를 독립 git 레포로
  (중첩 .git, remote github.com/widkhdl11/wama) → Vercel Git 자동배포**. 독립 레포는 앱=루트라 Vercel Root Directory 비워야 함
  (projects/wama로 두면 package.json 못찾아 실패). supabase/는 wama 레포에서 gitignore(로컬전용; GitHub 삭제+pull로 로컬도
  지워졌던 걸 git 히스토리에서 복원). URL: wama-widkhdl11s-projects.vercel.app.
- 봇/크롤 차단: robots.txt Disallow:/ + noindex meta + Vercel Firewall Bot Protection=Challenge(비브라우저 챌린지). SSO
  Deployment Protection은 관람자도 막아 데모엔 부적합 → Bot Protection 권장. 백엔드는 anon 공개라 Supabase CAPTCHA/이메일확인 필요.
- 시크릿 잠금(SUPABASE_TOKEN=Management API 강력키): apply-migrations를 process.env 전용으로(파일 안읽음·값 미출력),
  .claude/hooks/protect-secrets.mjs 신설(.env read + SUPABASE_TOKEN 참조 + env 덤프 차단, 4케이스 검증), settings.json
  Read(./.env*) deny. 과거 커밋/히스토리 유출無 확인. 다음 프로젝트부터 Supabase 모던키(publishable/secret) — 메모리 저장.
- 검증: 매 단계 tsc·gates·vite build green, 통합테스트 17 green, 배포 Ready.

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
