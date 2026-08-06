# MIGRATIONS.md — 스키마 변경 장부

**왜 이 파일이 있나.** `supabase/` 폴더는 두 레포 모두 `.gitignore` 대상이라(DECISIONS 2026-07-28)
마이그레이션 SQL 이 **작성한 PC 에만 존재**한다. 그러면 "어떤 변경이 있었는지"도, "그게 DB 에 적용됐는지"도
어디에도 남지 않는다. 실제로 0013 을 적용하고 나서 그 사실이 PROGRESS 로그 문장 속에만 있어
찾기 어려웠다(2026-08-06). 그래서 **추적되는 곳(workspace/)에 장부를 따로 둔다.**

**규칙**
- 마이그레이션을 새로 쓰면 이 표에 한 줄 추가한다 (적용 전이라도).
- 호스팅 DB 에 적용하면 `적용` 칸을 채운다. **적용 출력을 확인하기 전에 다음 작업으로 넘어가지 않는다**
  (2026-08-04 에 미적용 상태를 "저장됨"으로 오인해 두 조각을 헛돌았다).
- 새 PC·새 프로젝트에서 처음부터 세울 때는 위에서부터 순서대로 실행한다.
- 파일이 사라진 변경은 **아래 "SQL 원문 보관"에 전문을 남긴다** — 파일이 gitignore 라 이게 유일한 사본이다.

## 적용 이력

| # | 파일 | 무엇을 바꿨나 | 적용 |
|---|---|---|---|
| 0001 | `0001_init.sql` | 최초 스키마 — academy·teacher·student·schedule·evaluation + RLS 격리 | ✅ 2026-07-24 |
| 0002 | `0002_academy_profile.sql` | academy 에 지점명·전화번호(표시 필드) | ✅ 2026-07-24 |
| 0003 | `0003_fix_join_code.sql` | 참여 코드 생성을 `gen_random_uuid` 로 (pgcrypto 가 search_path 에 안 보여 런타임 실패했음) | ✅ 2026-07-24 |
| 0004 | `0004_harden_search_path.sql` | SECURITY DEFINER 함수에 `set search_path = ''` — pg_temp 섀도잉으로 격리 우회가 실증됐음 | ✅ 2026-07-24 |
| 0005 | `0005_subject.sql` | subject 엔티티 승격(학원별 과목 CRUD) | ✅ 2026-07-25 |
| 0006 | `0006_student_schedule.sql` | student age→birth_date+grade_offset, schedule 에 teacher | ✅ 2026-07-25 |
| 0007 | `0007_exam.sql` | exam + exam_score 1:N, 원자적 저장 RPC | ✅ 2026-07-25 |
| 0008 | `0008_exam_student_guard.sql` | exam RPC 에 student 소속 검증(방어 심화) | ✅ 2026-07-25 |
| 0009 | `0009_academy_payment_settings.sql` | 입금 계좌 + 기본 안내 문구 컬럼 | ✅ 2026-08-04 |
| 0010 | `0010_subject_price.sql` | 과목 가격표 (과목 × 주 횟수) → 월정액 | ✅ 2026-08-04 |
| 0011 | `0011_student_subject_fee.sql` | 학생별 과목 금액 예외 | ✅ 2026-08-04 |
| 0012 | `0012_academy_settings_update.sql` | academy 결제 설정 4개 컬럼만 UPDATE 허용(통짜 아님 — INV-A6 보호) | ✅ 2026-08-04 |
| 0013 | `0013_schedule_time_optional.sql` | 시간표 시작·종료를 선택 입력으로 + 둘 다이거나 둘 다 아니거나 CHECK | ✅ 2026-08-06 |

## 적용 방법

```bash
# 환경변수에 관리 토큰이 있을 때 (없으면 아래 대시보드 경로)
node scripts/apply-migrations.mjs <파일명>
```

토큰은 파일에 두지 않는다(hooks/protect-secrets.mjs 가 차단). 없으면
**Supabase 대시보드 → SQL Editor** 에 붙여넣어 실행하고, 위 표의 `적용` 칸을 채운다.

## SQL 원문 보관 (파일이 gitignore 라 이게 유일한 사본)

### 0013 — 시간표 시간 선택 입력 (2026-08-06 적용됨)

```sql
alter table schedule alter column start_time drop not null;
alter table schedule alter column end_time   drop not null;

-- 한쪽만 채우는 것은 막는다 — "17:00–" 반쪽 표시가 화면마다 분기를 낳는다.
-- 0001 의 check (end_time > start_time) 은 NULL 이 섞이면 NULL(=통과)이라 이것만으론 못 막는다.
alter table schedule drop constraint if exists schedule_time_pair;
alter table schedule add constraint schedule_time_pair
  check ((start_time is null) = (end_time is null));
```

0001~0012 원문은 이 PC 의 `projects/wama/supabase/migrations/` 에 있다.
**이 PC 를 잃으면 복구할 수 없으므로**, `supabase/` 를 gitignore 에서 빼는 것을 검토할 것 (미결 —
빼면 스키마 역사가 버전 관리되지만, 과거에 "SQL 은 로컬 전용" 으로 정한 이유를 함께 확인해야 한다).
