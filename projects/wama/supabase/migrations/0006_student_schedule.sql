-- 0006: student·schedule 스키마를 현행 도메인 모델에 정합시킨다 (데이터 계층 재개).
-- 배경: 0001 은 student.age(int)·teacher 없는 schedule 로 만들었으나, 이후 도메인은
--   · 학년을 birth_date + grade_offset 에서 파생(매년 자동 진급, DECISIONS 2026-07-24)
--   · 시간표 슬롯에 담당 선생님(teacher) 표시
-- 로 굳어졌다. 스키마를 모델에 맞춘다. 격리(RLS)는 0001 그대로 유효.

-- ── student: age → birth_date + grade_offset ─────────────────────────────
-- age 는 파생값이므로 저장하지 않는다(생년월일에서 계산). 기존 age 컬럼 제거.
alter table student drop column if exists age;
-- birth_date 는 nullable — 기존(테스트) 행에 값이 없을 수 있어 NOT NULL 을 강제하지 않는다.
-- 신규 등록은 앱 경계(폼·repo)에서 생년월일을 필수로 받는다. 값이 없으면 학년은 "미정"으로 파생.
alter table student add column if not exists birth_date  date;
alter table student add column if not exists grade_offset int not null default 0;

-- academy_id 를 서버가 채우게 한다(클라이언트는 업무 필드만 insert). WITH CHECK 가 위조를 거부(INV-A3).
alter table student  alter column academy_id set default current_academy_id();

-- ── schedule: 담당 선생님 컬럼 + academy_id 기본값 ────────────────────────
alter table schedule add column if not exists teacher text;
alter table schedule alter column academy_id set default current_academy_id();
