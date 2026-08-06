# PROGRESS.md

## 현재 상태 (wrap-up이 갱신 — 이 블록만 세션 시작 시 읽힘)

- 오늘의 목표: (계획에 없던 전환) **vanilla DOM → React 19 전환. 달성.** 사용자가 코드를 처음 열어보고
  "내가 짜던 리액트 형식이 아닌 것 같다"고 지적해 시작 — UI 프레임워크가 동의 없이 정해져 있었다.
- 완료: 화면 20개(pages 12 + widgets 8) React 19 + react-router-dom 7 재작성, entities·features 1,814줄 무손실 ·
  리뷰 3종(code·security·ui) 지적 6건 전부 수정(0원 청구서 경로 2건 · 수정폼 새 레코드 생성 · 학년 지정 무시 ·
  period 형식 두 벌 · 세션 소멸 미감지 · 정의 없는 CSS) · **PNG 저장 눈확인 완료 → 필수기능 4/8** ·
  **꺼져 있던 봉인 검증 복구**(spec-coverage) · skill-manager 수정. 테스트 152→180, 커밋·푸시 두 레포 완료.
- 멈춘 지점: 없음 — 시작한 작업은 모두 마무리·커밋·푸시됨.
- 다음 할 일: `/spec student-registration` 으로 학생 등록/수정 스펙을 채운다(학년은 자동 진급하는 시변 파생 상태인데
  규칙이 코드·DECISIONS 에만 있다 — 오늘 4번 버그로 드러난 빈칸). 그다음 schedule·evaluation·exam-score 순.
- 대기 중인 결정: `/retro` 실행 여부(구조적 빈칸 2건: ① UI 프레임워크가 물어보는 자리 없이 정해짐 ② 게이트가
  커밋 없이 약화됐는데 세션 내내 몰랐음) · pull.mjs 의 BUNDLES_DIR 한 줄(분류기 차단, 꾸러미 가져오기 불가) ·
  킷 브랜치 upstream 연결(`git branch --set-upstream-to`, 안 걸면 안 밀린 커밋이 안 보임) ·
  스펙 4종 여전히 빈 템플릿 · 실배포 시 이메일확인 재활성.

---

## 로그 (append-only — 필요할 때만 검색)

### 2026-08-05 (vanilla DOM → React 19 전환 · 리뷰 6건 · 꺼진 게이트 복구)
- **발단**: 사용자가 `subjects/ui.ts` 를 처음 열어보고 "그동안 내가 짜던 리액트 형식이 아닌 것 같다"고 지적.
  확인해보니 React 가 없었다. PRODUCT.md 기술결정에 "프레임워크/렌더링: **Vite** + SPA + FSD — 확정"이라고만
  적혀 있었는데 **Vite 는 빌드 도구지 UI 프레임워크가 아니다.** 그 한 칸이 두 결정을 뭉쳐놓은 탓에
  "React 를 쓴다/안 쓴다"는 물어본 적도 기록된 적도 없이 vanilla DOM(`el()` 헬퍼 46줄)으로 9개 화면이 만들어졌다.
  유일한 흔적은 PROGRESS 구현로그 한 줄("vanilla TS+Vite") — 결정이 아니라 사후 보고였다.
- **전환**(사용자 결정: React + react-router-dom, 한 번에 전부): pages 12 + widgets 8 = 2,431줄 재작성.
  entities 20파일(1,684줄)·features·유닛테스트·CSS·SQL 은 **손대지 않고 그대로 재사용** — FSD "entities 는 UI 를
  모른다" 규칙이 실제로 값을 한 지점(DOM 참조 0건을 grep 으로 확인하고 시작했다).
  shared/lib/dom.ts·router.ts 삭제, form.ts → shared/ui/form.tsx(React 컴포넌트·훅), app/main.tsx 신설.
  app 레이어를 여러 파일로 쪼개면 FSD 게이트가 cross-slice 로 막아서 부트스트랩은 한 파일로 뒀다.
  Vite 5·Vitest 2 는 유지(@vitejs/plugin-react 4.7.0 이 Vite 5 지원) — 툴체인 업그레이드를 전환에 끼워넣지 않았다.
- **리뷰 3종 → 지적 6건, 전부 수정**. 중요한 건 **6건 모두 vanilla 때부터 있던 버그**였고 `git show HEAD:...` 로
  하나씩 대조해 확인했다는 점이다(리뷰어 3명 다 셸이 없어 "회귀"로 잘못 분류한 것을 바로잡음).
  전환이 실제로 만든 회귀는 2건뿐 — 숨김을 `<div>` 래퍼로 감싸 `.form-card` 의 flex gap 이 죽은 것,
  헤더를 늦게 붙여 sticky 삽입 시 본문이 64px 점프한 것.
  - **0원 청구서 경로 2건**(가장 위험): `Number("") === 0` 이 뿌리. ① 과목 가격표에서 금액칸을 비우고 저장하면
    0원 수강료가 조용히 등록 → 그 조합이 "가격 없음"이 아니라 "0원 가격"이 되어 INV-PN6 의 생성 차단이 안 걸린다.
    ② 내보내기 화면의 무효 금액이 조용히 버려져 **입력칸에 보이는 값과 다른 금액(가격표 값)으로 PNG 가 나갔다** —
    스펙 S2 는 "검증에서 막히고 이미지가 만들어지지 않는다"인데 실제는 "무시되고 옛 값으로 만들어진다"였다.
    둘 다 스펙 위반이라 🔓 갱신·🔒 재봉인 없이 코드만 고침. entities 에 parseSubjectFeeInput·parseFeeEdits 신설.
    **직접 친 0 은 면제라는 실제 의미가 있어 그대로 받는다** — 막은 건 "비운 것"이지 "0"이 아니다.
  - 학년 "직접 지정"이 표준 범위 밖에서 무시되던 것: 화면이 표준 학년을 **번호→라벨→번호로 왕복**시켜
    사다리 밖에서 null 이 되고 오프셋이 0 으로 뭉개졌다. 그런데 화면이 "범위를 벗어남 — 직접 지정하세요"라고
    안내하는 시점이 정확히 그때라 **화면이 시킨 행동이 100% 실패**했다. entities 에 gradeOffsetFor 신설.
  - period 형식이 pages(조립)/stats(파싱) 두 벌: stats 는 **import 0건 자족 슬라이스**라 코드로 합칠 수 없다
    (FSD 동일 레이어 금지). 그래서 exam-score 를 형식의 주인으로 삼고, 계약을 **양쪽 테스트에 같은 문자열
    리터럴**로 고정 — 한쪽만 바꾸면 반대쪽 테스트가 깨진다.
- **꺼져 있던 게이트 발견·복구**: `gates/spec-coverage.mjs` 워킹트리 버전에서 **봉인 검증이 통째로 빠져 있었다**
  (죽은 주석·잘린 문장이 되살아난 걸로 보아 예전 사본이 덮어써진 것). 마지막 커밋이 `harness: 봉인 검증 구멍 수정`
  (ed7bdbd, 7/30)인데 그 강화가 커밋 없이 되돌려진 상태. 즉 **세션 내내 보고한 "게이트 통과"에 봉인 검증이 빠져
  있었다.** approved 3종 해시를 직접 계산해 전부 일치함을 확인한 뒤(변조 없음) `git checkout` 으로 복구.
  불은 안 났지만 화재경보기가 꺼져 있던 셈.
- **테스트 152 → 180(+28)**: 늘어난 28개는 전부 위 버그의 재발 방지. TDD 규칙대로 red 출력을 확인하고 구현했다.
- 커밋 3건(wama db2714e / 킷 f01123f·9510755), 두 레포 푸시 완료. PNG 저장 눈확인 → 필수기능 4/8.
- 부수: skill-manager 가 세 기능 중 둘이 죽어 있었다(창고 주소가 없는 계정 + SSH 키 없음 → HTTPS,
  폴더명 bundles→plugins, doc.mjs 의 CRLF 파싱 실패로 설명 2건이 빈칸). SKILLS.md 에 "쉬운 설명" 분리 도입 —
  SKILL.md 의 description 은 모델이 호출을 판단하는 문장이라 쉽게 풀어쓰면 스킬이 제때 안 불린다.

### 2026-08-04 (수강료 안내 이미지 — 설정 3종 + 내보내기 구현 · 버그 3건 · 게이트 신설)
- **구현 4조각**: ① 학원 설정(계좌·기본 문구, 0009) ② 과목 가격표(0010) ③ 학생별 과목 예외(0011)
  ④ 내보내기 화면 + PNG 캡처. ①~③은 브라우저 실동작 확인, ④는 코드까지만.
  PNG는 html2canvas(사용자 A안 — 승인된 시안 HTML/CSS 를 그대로 그림으로. Canvas 직접 그리기는 시안과 코드가
  갈라져 동기화를 사람이 떠안게 되므로 기각). 캡처는 미리보기(zoom 축소)가 아니라 화면 밖 원본 크기 노드로 하고,
  `document.fonts.ready` 를 기다린다(대체 폰트로 찍히는 것 방지).
- **버그 3건 — 전부 타입·테스트·게이트를 통과한 채로 틀려 있었다**:
  (a) 과목 추가·삭제 시 가격 폼 select 와 가격표가 안 따라감 → 과목 목록을 상태 하나로 통합.
  (b) 시간표가 편집 화면 1줄 / 상세 화면 2줄 → 묶는 규칙(groupSlots)을 entities 로 올려 양쪽이 공유.
  (c) **academy 에 UPDATE 정책이 없어 설정 저장이 조용히 실패**(0001 은 academy 를 읽기전용으로 설계).
      RLS 는 막힌 UPDATE 를 에러가 아니라 **0행**으로 돌려주므로 "저장은 눌리는데 값이 안 바뀜"으로 보였다.
      0012 로 열되 **통짜가 아니라 컬럼 권한**(GRANT UPDATE (4개 컬럼))으로 — INV-A6(join_code) 보호.
      불변식 문구는 안 바뀌어 재봉인 불필요.
- **패턴 인식(사용자 질문에서 촉발)**: 위 셋 + 금액 규칙 중복까지 전부 "같은 진실이 두 벌"이라는 한 병이었다.
  증상만 세 번 고치고 ③(다른 데도 같은 모양이 있나) ④(재발 차단)를 안 했다는 지적을 받고 그 자리에서 수행:
  ③ 훑어서 2건 추가 발견·수정(evaluation-history 월그룹 → groupByMonth, student-fee-overrides 가격필터 →
  pricesForSubject). ④ **gates/rls-coverage.mjs 신설** — RLS 켰는데 정책 0개 / 앱이 쓰는데 select 정책뿐인 경우를
  잡는다. 정적으로 확실한 것만 보고 컬럼권한·조건식 옳고그름은 통합테스트 몫으로 남김(오탐 방지).
  ui-layers.md 에 "묶기·정렬·파생은 entities" 한 줄 추가(사용자 반영).
- **마이그레이션 적용 삽질**: 관리 토큰이 셸 환경에 없어 두 번 실패했는데, 적용 **출력을 확인하지 않고** 다음 조각으로
  넘어가 두 조각을 헛돌았다(0009 미적용 상태에서 "저장됨"으로 오인 — 실제로는 새로고침 안 한 폼 잔상).
  결국 대시보드 SQL Editor 로 적용. 교훈: 적용 출력을 보기 전에 다음으로 넘어가지 않는다.
- 기타: PostgREST 조인은 복합 FK 에서 `subject:subject_id(...)` 힌트가 안 먹어 400 → `subject(name)` 으로
  (임시 통합테스트로 실측 진단 후 두 repo 수정). 낡은 카피 2건 정정(학생 상세 버튼 → 실제 링크, 평가 입력 문구).
- 검증: 테스트 152 green(오늘 +18), tsc·vite build·게이트 62파일 green.

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
- 횡단 미결: \_cross-cutting.md에서 과목 분열·점수 단위(만점) stats 몫 소진(관련 목록에서 stats 제거, 다른 스펙 몫은 유지).
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
  Read(./.env\*) deny. 과거 커밋/히스토리 유출無 확인. 다음 프로젝트부터 Supabase 모던키(publishable/secret) — 메모리 저장.
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
  +tests/\*\* 경로)·D(protect-files.mjs+settings.json — Bash 우회 구멍 차단, 9케이스 검증). A·D는 보호파일이라 사용자 반영.

### 2026-07-24

- 화면 대량 구현(fixture, 빠른 경로): 학생 상세(시간표·시험성적·월간평가·수강과목 + 정보수정·평가표 내보내기 버튼) / 등록·수정 폼 / 평가·점수 입력(점수는 정기=년도·학기·비정기=시험명·시기 전환 + 과목별 다행 입력) / 평가·점수 수정 모드 / 인증 3화면 / 시간표 관리(요일 다중 체크박스) / 과목 관리. 얇은 해시 라우터(shared/lib/router)·공유 폼 프리미티브(shared/lib/form) 재사용.
- 새 시각 표면 2종 시안 국면(design-drafter→checkpoint→design-rules 기록): 인증(400px 카드·탭 세그먼트·중앙 브랜드·focus 글로우) / 통계(dataviz — 반복 수정 후 승인: 3탭[전체·과목별·학년별]·2년 9시점 꺾은선·area·드릴다운 순위표+네비). 통계는 pages/stats 실동작 미구현.
- 모델 교정(설계단계 catch): 나이·학년=생년월일 파생(offset, 유급/빠른년생), 학생↔과목 1:N(과목=시간표 파생, 등록폼서 제거), 월간평가 년.월 묶기, 시험 정기(중간·기말=년+학기)/비정기(학원·모의=이름+시기)·시험명 조건부·통계 정기만·학원모의 나중, 통계 평균정의(학생별 평균의 평균), 요일 다중. 전부 PLAN 모델링 플래그+DECISIONS에 박음.
- 하네스 업그레이드(retro 종류 필터 신설): modeling-checklist.md(도메인무관 9항목, INV 예시·권장패턴)+kickoff(얕게 플래그)·/spec(깊게 INV)·CLAUDE 위험목록 라우팅 / retro 빈도→종류 판별(구조적빈칸 1회라도 vs 판단실수) / harness-backlog.md(+retro 스캔+briefing 리마인더) / spacing 토큰(--space-\*)+짝수 규칙(짝수 게이트 제안=미반영) / briefing 순서가드(DB-먼저 경보) / 여백 정규화·[hidden] 리셋.
- ui-reviewer 반영: 상세·등록·평가/점수·인증 각 화면 리뷰 후 수정(label-for·focus링·틸 절제·토큰·시안 일치). 검증: 매 편집 tsc/게이트 green(29파일), vite build 성공. 브라우저 자동 스크린샷 불가 환경(사용자 수동 확인).

### 2026-07-21

- 예제(funding) 프로젝트 삭제 → 킷을 멀티 프로젝트 구조(projects/<이름>/)로 개편: gates(run-gates·spec-coverage)·scaffold(package.json·vite.config 생성 포함)·rules·스킬·에이전트 경로 일괄 갱신. 디자인도 프로젝트별(projects/<이름>/design-rules.md·mockups/).
- retro: "스테이지를 사용자 동의 없이 진행" 실패 → 아티팩트 의존 게이트 `design/BEFORE_UI` 신설(UI 레이어 작업은 승인된 design-rules.md 전제). LESSONS.md 반영은 사용자 몫으로 제안.
- wama: kickoff→PLAN, setup(supabase.md·security-reviewer를 학원격리 기준으로 정정), /spec auth-isolation(INV-A1~A8, 설계승인), DB SQL 작성(security-reviewer 통과, low 4건) — DB는 디자인 우선 원칙에 따라 파킹.
- 평가 이원화 결정: 월간 서술 평가 + 시험별 점수 이력(exam_score, 신규) 둘 다. 통계 페이지 선택→필수 승격.
- 디자인 국면: 학원생 목록 시안 승인(대기뱃지 회색·나이 제거) → design-rules approved + tokens.css. 시각언어: 신뢰+친근, 틸(#0d9488) 단일 강조, 라이트, 표 중심.
- 구현: 학원생 목록 화면 FSD 구현(vanilla TS+Vite, fixture 10명). ui-reviewer 반영 — 대비(brand-strong #0f766e 도입, 사용자 승인)·포커스 링·본문 16px·완료율 계산 위치(entities)·토큰화. 게이트 green. (spacing 토큰 스케일 도입은 보류)
- 검증 메모: Vite 서빙·모듈 변환 확인. 브라우저 자동 스크린샷은 이 환경에서 Chrome이 로컬 서버(127.0.0.1) 접근 실패 — 앱 결함 아님, 수동 확인 필요.
