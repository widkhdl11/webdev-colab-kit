-- 0007: 시험 성적 = 시험(부모) → 과목 점수(자식) 1:N (DECISIONS 2026-07-25).
-- 정기시험(중간·기말)은 다과목, 학원·모의는 1~다과목. 한 시험이 여러 과목 점수를 가진다.
-- 격리: exam 은 academy_id 로 직접 스코프(student 패턴), exam_score 는 부모 exam 의 소속으로 스코프.

create table exam (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null default current_academy_id() references academy(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  exam_name  text not null check (length(trim(exam_name)) > 0),
  kind       text not null check (kind in ('중간', '기말', '학원', '모의')),
  period     text not null check (length(trim(period)) > 0),  -- 표시 시기: "2026 1학기" | "2026.07.12"
  created_at timestamptz not null default now()
);
create index exam_student_idx on exam(student_id);

-- 한 시험의 과목별 점수 한 줄. max_score>0 (백분율 분모), score>=0.
create table exam_score (
  id        uuid primary key default gen_random_uuid(),
  exam_id   uuid not null references exam(id) on delete cascade,
  subject   text    not null check (length(trim(subject)) > 0),
  score     numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0)
);
create index exam_score_exam_idx on exam_score(exam_id);

alter table exam       enable row level security;
alter table exam_score enable row level security;

-- exam: student/schedule 과 동일한 학원격리 CRUD (INV-A1/A2/A3)
create policy exam_all on exam for all to authenticated
  using (academy_id = current_academy_id())
  with check (academy_id = current_academy_id());

-- exam_score: academy_id 컬럼이 없으므로 부모 exam 의 소속으로 격리. insert/update 시에도
-- 부모가 내 학원 시험이어야만 허용(WITH CHECK) → 타 학원 exam 에 점수 끼워넣기 차단.
create policy exam_score_all on exam_score for all to authenticated
  using (exists (
    select 1 from exam e where e.id = exam_score.exam_id and e.academy_id = current_academy_id()
  ))
  with check (exists (
    select 1 from exam e where e.id = exam_score.exam_id and e.academy_id = current_academy_id()
  ));

-- ── 원자적 write RPC ────────────────────────────────────────────────────
-- 시험 1개 + 과목 점수 N개는 반드시 함께 저장돼야 한다(반쪽 시험 금지) → 한 트랜잭션(RPC).
-- security invoker: 호출자(authenticated) 권한으로 실행되어 RLS·academy_id 기본값이 그대로 적용된다
--   → 격리는 여전히 RLS 가 강제(타 학원 시험엔 exam_score WITH CHECK 로 끼워넣기 차단).
-- search_path='' + public. 한정으로 pg_temp 섀도잉 방지(0004 교훈). 점수는 jsonb 배열로 받는다.
create or replace function create_exam_with_scores(
  p_student_id uuid, p_exam_name text, p_kind text, p_period text, p_scores jsonb
) returns uuid
  language plpgsql security invoker set search_path = '' as $$
declare
  new_exam_id uuid;
  s jsonb;
begin
  insert into public.exam(student_id, exam_name, kind, period)
    values (p_student_id, p_exam_name, p_kind, p_period)
    returning id into new_exam_id;
  for s in select * from jsonb_array_elements(p_scores) loop
    insert into public.exam_score(exam_id, subject, score, max_score)
      values (new_exam_id, s->>'subject', (s->>'score')::numeric, (s->>'max')::numeric);
  end loop;
  return new_exam_id;
end $$;

-- 수정: 시험 필드 갱신 + 점수 전량 교체(삭제 후 재삽입)를 한 트랜잭션으로. RLS 로 타 학원 시험은
-- update 0행 → 이어지는 exam_score insert 가 부모 소속 불일치로 거부되어 롤백(격리 유지).
create or replace function update_exam_with_scores(
  p_exam_id uuid, p_exam_name text, p_kind text, p_period text, p_scores jsonb
) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  s jsonb;
begin
  update public.exam set exam_name = p_exam_name, kind = p_kind, period = p_period where id = p_exam_id;
  delete from public.exam_score where exam_id = p_exam_id;
  for s in select * from jsonb_array_elements(p_scores) loop
    insert into public.exam_score(exam_id, subject, score, max_score)
      values (p_exam_id, s->>'subject', (s->>'score')::numeric, (s->>'max')::numeric);
  end loop;
end $$;
