# DECISIONS.md — 결정 기록

형식: 날짜 | 결정 | 근거 | 대안과 기각 이유

2026-07-21 | 프레임워크: Vite + SPA + FSD (Next.js 대신) | 로그인 뒤 내부 CRUD 대시보드라
SSR/SEO 불필요. 하네스 프리셋과 정합해 scaffold·gates·rules 재작업 없이 시작 |
대안 Next.js 기각 — 프리셋 교체 비용(App Router app/ ↔ FSD 레이어 충돌 정리, 게이트 재작성)이
이 앱의 이득보다 큼.

2026-07-21 | 소유 모델: 학원(조직) 단위 공유 | 한 학원의 여러 과목 선생님이 같은 학생을
담당·평가하는 실제 운영에 맞음 | 대안 '선생님별 독립' 기각 — 과목별 담당·공유 흐름을 표현 못 함.
권한은 academy_id 스코프로 서버(Supabase RLS)가 강제 (스펙에서 불변식 확정 필요).

2026-07-21 | 평가 모델 이원화: 월간 서술 평가 + 시험별 점수 이력 둘 다 유지 | 서술 평가는
학부모용 평가표(이미지/PDF) **→ 이 용도 부분만 번복됨(2026-08-03)**, 점수 이력은 통계·추이용 — 목적이 달라 하나로 합치면 둘 다 약해짐 |
대안 '점수가 평가 대체'·'점수를 평가 필드로 포함' 기각(통계 표현력 손실). 통계 페이지 선택→필수 승격.
exam_score 테이블 신규(academy_id RLS 동일 적용) — DB 재개 시 0001_init.sql에 추가.

2026-07-21 | wama 시각 방향: 신뢰 기반+약간 친근, 라이트, 정보 밀집(표), 살짝 라운드,
깔끔한 고딕, 틸/그린(#0D9488) 단일 강조 | design-interview 상담 결과 | 대안 '플레이풀 우선'·
'신뢰만' 기각(절충). checkpoint 승인 시 projects/wama/design-rules.md에 확정.

2026-07-24 | 월간 평가는 (학생, 년.월)로 묶어 표시·관리 | 과목별로 기록돼 한 달에 여러 개가 생김 →
한 달 = 학부모 전달용 평가표 한 장의 단위 **→ "평가표 내보내기" 근거는 번복됨(2026-08-03). 월 그룹핑 자체는 유효** |
대안 '평탄 나열' 기각(월 반복·평가표 단위 불명확).
이력은 월 그룹(과목 중첩), ~~내보내기도 월 단위~~. 데이터: evaluation은 (student, subject, month)당 1건.

2026-07-23 | 학생↔과목 1:N — 과목은 학생 필드가 아니라 시간표(수강) 레코드로 | 한 학생이 여러 과목
수강, 과목마다 요일·시간 상이 → 시간표가 곧 수강 과목 | 대안 '학생에 단일 과목' 기각(다과목 불가)·
'학생에 과목 리스트 별도 보유' 기각(시간표와 이중 관리). Student.subject → subjects(읽기모델은 시간표
파생), 등록 폼에서 과목 제거. modeling-checklist에 항목9(카디널리티) 추가 — 이번에 드러난 사각지대.

2026-07-23 | 간격(spacing) 정책: **공통 레이아웃은 spacing 토큰(--space-\*), 일회성은 짝수 px 허용(홀수 금지)** |
규칙은 "간격도 토큰"인데 tokens.css엔 spacing 토큰이 없어 리뷰어가 3회 반복 플래그(규칙↔현실 모순) |
대안 '전부 토큰 강제' 기각(이 규모에 과함)·'전부 px 허용' 기각(들쭉날쭉 허용). ui-layers.md·design-rules.md·tokens.css
문구 정합화. 짝수 강제는 게이트로 승격 예정(제안됨 — gates/ 보호라 사용자 반영). 홀수 1건(btn-ghost--sm 5px→6px) 수정.

2026-07-23 | 학생 나이 축: **생년월일(birth_date) 저장 + 나이는 표시 시 자동 계산** | 나이를
숫자로 저장하면 학년과 똑같이 매년 상함(생일마다 수동 갱신). 생년월일은 불변이라 나이가 영원히 정확 |
대안 '나이 숫자 저장' 기각(staleness 동일). 학년(grade)은 별도 필드로 유지 — 진급은 실제 상태 전이라
연 1회 갱신이 정상(데이터 냄새 아님). 화면 표시는 개인정보 최소 노출로 학년만(나이/생년월일 표에 미노출,
design-rules 준수). DB 재개 시 student 테이블에 birth_date 컬럼 반영.

2026-07-24 | 격리 단위 = 학원(academy). 지점(branch)·전화(phone)는 academy의 표시 필드 | 온보딩이
지점명을 받지만, 한 학원=한 격리 경계가 MVP에 충분하고 스키마·RLS가 이미 academy 기준 | 대안 '지점을
별도 엔티티로 격리' 기각(branch 테이블·RLS 재설계 비용, 다지점 요구 아직 없음). PLAN 🟡 학원↔지점
카디널리티 플래그 종결. 마이그레이션 0002로 academy에 branch/phone(nullable) 추가 + create_academy_and_join 확장.

2026-07-24 | 이메일 확인(email confirmation)은 켜둔 채 유지 — autoconfirm 미적용 | 미성년 데이터
취급상 확인 절차가 옳음. autoconfirm PATCH는 분류기가 차단(보안 태세 하향)했고 우회하지 않음 | 결과:
회원가입→온보딩→앱 해피패스가 메일 서버 없이는 완결 안 됨(가입 후 확인 링크 필요). 데모/통합테스트를
위해 autoconfirm이 필요하면 사용자가 대시보드에서 켜거나 Bash 권한을 부여해야 함 — **미결(사용자 결정)**.
스펙 auth-isolation은 커밋된 INV 통합테스트 전까지 status:draft 유지(행동 검증은 롤백 SQL로 A1~A8 통과).

2026-07-24 | Supabase 프로젝트 프로비저닝: name=wama, ref=zubdbqlrcuywvelvnfle, 리전 ap-northeast-2(서울),
조직 widkhdl11's projects(free) | 데이터 계층 착수 | URL/anon 키는 projects/wama/.env(gitignore). 루트 .env의
SUPABASE_TOKEN(Management API)로 생성. 마이그레이션 0001~0003 적용됨. service_role은 코드/디스크에 저장 안 함(차단됨·불필요).

2026-07-24 | 참여 코드 생성은 core 함수 gen_random_uuid 사용(pgcrypto gen_random_bytes 아님) | 버그:
gen_random_bytes는 Supabase에서 extensions 스키마에 있어 search_path=public인 security definer 함수에서
안 보여 create_academy_and_join이 런타임 실패(행동 검증이 잡음, 구조 검증은 못 잡음) | 마이그레이션 0003.
12 hex(48bit) 유지. 교훈: security definer + 고정 search_path는 확장 함수 스키마를 놓치기 쉬움 → 행동 테스트 필수.

2026-07-24 | SECURITY DEFINER 함수 search_path 강화(0004): `set search_path = ''` + 전체 스키마 한정 |
security-reviewer가 HIGH 지적 → 익스플로잇으로 확인: `set search_path=public`은 relation 조회에서 pg_temp를
먼저 탐색하는 걸 못 막아, 인증 사용자가 temp table teacher로 current_academy_id()를 위조 → 격리 전면 우회(실증됨:
after_shadow=위조값). 0004 적용 후 재실증 exploited=false + A1~A8 회귀 통과 | 교훈: security definer에는 반드시
빈 search_path+완전 한정. **구조 검증(정책 존재)만으론 못 잡음 — 행동 검증(롤백 트랜잭션) 필수.** 게이트 lint
후보(harness-backlog): security definer + non-empty search_path 탐지.

2026-07-25 | autoconfirm(이메일 확인) 최종 OFF + auth-isolation 스펙 approved | 사용자가 대시보드에서 Confirm email
끔(연습 데모·통합테스트용). INV-A1~A8 통합테스트 green(두 학원 세션) → 스펙 draft→approved. **실배포 시 확인 재활성 필요.**
2026-07-24 "autoconfirm 미결" 항목을 이걸로 종결.

2026-07-25 | 시험 성적 = 시험(부모)→과목 점수(자식) 1:N, 상세 요약은 "시험 단위" | 정기시험은 다과목, 학원시험도
1~다과목인데 읽기모델이 (시험×과목) 평평 1행이라 같은 시험이 표에 반복됐음(입력 폼은 이미 다과목). 요약 평균/횟수는
과목쌍이 아니라 시험 단위(각 시험 과목평균→시험끼리 평균, 횟수=시험 수) | 대안 '과목쌍 평탄 평균' 기각(다과목 시험 과대반영).
표는 과목별 행+시험 rowspan 그룹. 통계 페이지의 "학생별 평균의 평균"(PLAN)과는 다른 축(상세 카드 표시용).

2026-07-25 | subject(과목)를 자체 테이블·엔티티로 승격 — 학원별 CRUD, Supabase 영구 저장(마이그레이션 0005) |
과목 관리 페이지가 하드코딩 상수(SUBJECTS)만 표시해 추가·삭제가 저장 안 됨(사용자 보고). model.ts의 "데이터 계층
재개 시 코드/엔티티화 검토" 플래그를 이 시점에 해소. 격리는 0001 패턴 재사용: academy_id 기본값 current_academy_id() + RLS subject_all(WITH CHECK). schedule/evaluation의 subject는 여전히 자유 문자열(FK 없음) — 과목 삭제는 목록에서만
제거, 기존 기록 문자열 유지 | 4개 페이지(subjects·schedule/evaluation/score 폼)가 listSubjects로 단일 출처 참조.
기존 학원엔 현행 6개 기본 과목 시드, 신규 학원은 빈 상태로 시작(각자 큐레이션). 첫 실제 엔티티 CRUD.

2026-07-25 | 데이터 계층 재개 — 전 엔티티(student·schedule·evaluation·exam) Supabase 영구 저장 + 전 폼 저장 연결 |
"과목 저장 안 됨"에서 출발해 앱 대부분이 목업+저장없음이고 스키마가 도메인 모델과 갈라진(학생 age↔birthDate,
시험 테이블 부재) 상태임이 드러남. 사용자 지시로 통계 제외 전부 실동작화. 스키마 정합: 0006(student age→
birth_date+grade_offset, schedule teacher, academy_id 기본값 current_academy_id()), 0007(exam+exam_score 1:N
+RLS, 시험+점수 원자적 저장은 서버 RPC — supabase.md 다중행 규칙), 0008(exam RPC에 student 소속 검증).
결정들: 읽기(list/get)=도메인 타입 반환+실패 시 빈결과+console.error, 쓰기=Result 반환+폼 에러 표시.
파생 필드(학년·수강과목·평가상태)는 학생 단일행 아니라 schedule/evaluation에서 계산(N+1 없이 학원단위 배치쿼리).
schedule/evaluation의 subject는 여전히 자유 문자열(FK 없음). 편집 라우트에 엔티티 id 부여(evaluate/:evalId/edit,
score/:examId/edit) → 위젯 editHref→editHrefFor(id). 마이그레이션은 scripts/apply-migrations.mjs(Management API)로 적용.
검증: 통합테스트 17개(INV-A1~A8 + subject·exam 격리) green, 유닛 10, tsc·gates·build green. 리뷰어 3종 반영
(빈점수 0저장 버그·과목 조용한 재할당·시간표 부분실패 중복·보조쿼리 로그 수정). 시연은 빈 DB에서 추가해가며 시작.

2026-07-28 | wama 배포 = projects/wama를 독립 git 레포(중첩 .git, remote github.com/widkhdl11/wama)로 두고 Vercel Git 자동배포 |
단일 앱 배포엔 모노레포 Root Directory 조정보다 독립 레포가 단순. 킷 게이트·훅은 파일편집 기준이라 wama에 계속 적용됨(바깥 git 추적만 분리) |
독립 레포는 앱=루트 → **Vercel Root Directory를 비워야 함**(projects/wama로 두면 package.json 못찾아 빌드 실패, "3 files"·ENOENT).
supabase/ SQL은 wama 레포에서 gitignore(로컬전용). 환경변수 파일은 gitignore라 Git빌드 시 Vercel에 VITE_SUPABASE_URL/ANON_KEY 등록 필요.
tsconfig baseUrl는 TS5.9에서 폐기 에러 → 제거(paths만으로 @/\* 해석). 앞으로 git -C projects/wama push → 자동배포.

2026-07-28 | 봇/크롤 차단 = robots.txt + noindex + Vercel Bot Protection(Challenge); SSO Deployment Protection은 데모 부적합 |
데모 링크는 사람은 보고 봇은 막아야 함. Bot Protection Challenge는 브라우저 자동통과·비브라우저 챌린지(관람자 편의 유지) |
SSO는 관람자까지 로그인벽으로 막음. 프론트 차단과 별개로 anon 키가 공개라 봇이 Supabase 직격 가능 → 백엔드는 CAPTCHA/이메일확인이 실방어선.

2026-07-28 | 프로젝트 관리 토큰(Management API 강력키) 다층 잠금 + 다음 프로젝트부터 Supabase 모던키 |
"노출되면 조직 전체 위험" → 절대 방지 요청. apply-migrations를 환경변수 전용(파일 미독·값 미출력)·hooks/protect-secrets.mjs
(환경변수 파일 read·토큰 참조·env 덤프 차단)·settings Read(deny) | 과거 커밋/히스토리 유출無 확인(이번 세션 노출 없었음).
현행 wama는 legacy anon 유지(동작·지원됨), 신규 프로젝트는 publishable/secret 기본(메모리 supabase-modern-keys).

2026-08-01 | 성적 통계 집계 규칙 확정(스펙 stats.md approved·봉인 INV-ST1~ST4) | 숫자가 정의에 따라 갈려 코드 전에 못박음.
평균=학생별 평균의 평균(학생 동등 가중 — 다과목 학생 과대반영 금지), 점수=만점 대비 백분율 환산(만점 가변), 미응시=집계 제외(0 아님),
정기(중간·기말)만 본선 그래프·모의는 개인 그래프 보조선(추후)·비정기(학원)는 별도 영역(추후), 과목=저장 문자열 그대로(엔티티 매칭·병합은
발명이라 비범위), 학년별=현재 학년 스냅샷. 시간축은 기존 입력폼 연도·학기 select로 충분 → exam 스키마 무변경(초기 우려한 자유문자열 파싱 불필요).
\_cross-cutting 의 과목 분열·점수 단위(만점)는 stats 몫만 소진(다른 스펙 몫 유지). 구현은 FSD 자족 슬라이스 entities/stats(집계) + RLS repo.

2026-08-03 | 필수기능 교체: "월간 평가표 이미지/PDF 내보내기" → "학부모 전달용 시간표·결제 안내 이미지 내보내기"
(스펙 evaluation-export.md → payment-notice-export.md 개명) | 디자인 인터뷰에서 사용자가 원한 산출물이
평가표가 아니라 **시간표+결제 안내 이미지**임이 드러남("평가는 내보내지 않는다"를 3회 명시). 2026-07-21·07-24의
"서술 평가 = 학부모용 평가표" 전제를 번복 — 서술 평가는 선생님 간 공유용으로 앱 안에만 남는다(기능 자체는 유지) |
결정들: PNG 카드 1080×1350 단일(PDF 기각 — 용도가 카톡/문자, 레이아웃 2벌 회피) · 다운로드만(공유링크·문자발송은
로그인 없는 접근 경로라 기각) · 금액은 **학생별 월 수강료로 저장**(F2-1) → 일괄 내보내기가 반복문이 되도록 모델을
먼저 잡음(화면은 1명 단위 선행) · 청구 이력 엔티티는 기각(수납관리로 번짐, 비범위) · 계좌·기본문구는 학원 설정 1벌 저장
(매번 타이핑 시 계좌 오타 = 돈 오배송) · PG 연동 비범위. 딸림: student에 월 수강료 필드(마이그레이션), academy에 계좌·문구.
돈이 걸려 정식 경로 — 시안 승인 후에도 스펙 approved 전 구현 금지.

2026-08-03 | 수강료 계산 모델 확정: 가격 = (과목 × 주 횟수) → 월정액. 주 횟수는 시간표에서 파생, 학생별 과목 예외로 할인 표현
(스펙 payment-notice-export.md approved·봉인 INV-PN1~PN7) | 인터뷰에서 "과목별 단가가 다르고, 횟수에 따라 다르고,
한 달로 계산한다(4주인 달과 5주인 달의 가격이 같다)". 총액을 손으로 저장하는 안(Q1-1)은 기각 — 과목을 끊어도 금액이
안 따라가 조용히 틀린 청구가 나감. 회당 단가 × 실제 달력 회차 안도 기각 — 4주/5주 문제·공휴일 차감·휴원 캘린더가
줄줄이 딸려오고 사용자가 월정액이라 명시 | 결정들: 청구액 = Σ(학생별 예외 ?? 가격표[과목, 주횟수]) · 주 횟수는 저장 금지
파생(INV-PN7, 시간표 수정이 금액에 즉시 반영) · 가격표에 없는 조합은 0원/근사 대체 금지, 빈칸 두고 생성 차단(INV-PN6 —
조용히 적게 청구되는 게 최악의 실패) · 내보내기 화면 수정은 이번 건 한정, 저장값 불변(INV-PN5) · 금액은 원 정수 고정(INV-PN2) ·
이미지에 평가·생년월일·연락처·주소 금지(INV-PN3) · 이름·대상월 없으면 생성 불가(INV-PN4, 오발송 탐지 수단) ·
서버에 이미지 보관 안 함(새 유출 표면). 딸림: 과목 가격표·학생별 예외·학원 설정(계좌·문구) 3종 마이그레이션.
횡단 미결 2건 소진(돈 값 단위·신뢰 / 전학 시 과거 학교 이력) → \_cross-cutting 5개→3개.

2026-08-04 | 안내 이미지 캔버스 = 폭 1080 고정 · 높이 가변(최소 1350). 시간표는 1열·열 머리 유지·시간 미표기 |
승인됐던 "정확히 1080×1350(4:5) 고정"을 번복한다. 1열 6과목이 1350 안에 안 들어가는데, 카드를 4:5로 묶으려면
시간표를 2열로 흘려야 하고 그 대가로 열 머리를 잃는다. 사용자 판단: **지켜야 할 것은 비율이 아니라 표의 읽는 법**
→ 열 머리 유지 + 카드가 내용만큼 길어짐(6과목 1566 / 1과목은 최소 1350) | 대안 기각: 2열 분할(열 머리 상실)·
폰트 자동 축소(6과목에서 과도)·두 장 분할(평균 3과목이라 매번 2장이 됨)·항상 긴 고정 판(과목 적으면 하단 공백).
시간 열은 F6 미표기 → 1차 checkpoint 포함 → 실물 렌더 확인 후 최종 제거(3회 번복). "학부모가 몇 시에 보낼지
모른다"는 우려는 제거 전에 제시됐고 사용자가 알고 선택 — 재론 시 이 우려부터 꺼낼 것(시안·design-rules 주석에 보존).
시간 열이 빠지며 생긴 좌측 쏠림은 과목/요일 50%씩 중앙 정렬로 교정. 스펙 불변식 무관 → 재봉인 불필요(🔓만 갱신).
