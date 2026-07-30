-- 0008: create_exam_with_scores 에 student 소속 검증 추가 (security-reviewer, defense-in-depth).
-- 배경: 0007 의 RPC 는 exam.academy_id 를 요청자 학원으로 강제하지만 p_student_id 가 내 학원 학생인지는
--   확인하지 않았다. 타 학원 학생 UUID(추측해야 함)로 내 학원에 시험을 만들 수 있는 무결성 구멍.
--   실제 유출은 아니나(생성 행은 내 학원 소유), 스펙 의도(모든 참조는 학원 내부)를 지키도록 경계에서 막는다.
-- update 쪽은 student_id 를 받지 않고 기존 exam(RLS 스코프)만 다루므로 이 검증이 불필요.

create or replace function create_exam_with_scores(
  p_student_id uuid, p_exam_name text, p_kind text, p_period text, p_scores jsonb
) returns uuid
  language plpgsql security invoker set search_path = '' as $$
declare
  new_exam_id uuid;
  s jsonb;
begin
  if not exists (
    select 1 from public.student
    where id = p_student_id and academy_id = public.current_academy_id()
  ) then
    raise exception 'student not in academy';
  end if;
  insert into public.exam(student_id, exam_name, kind, period)
    values (p_student_id, p_exam_name, p_kind, p_period)
    returning id into new_exam_id;
  for s in select * from jsonb_array_elements(p_scores) loop
    insert into public.exam_score(exam_id, subject, score, max_score)
      values (new_exam_id, s->>'subject', (s->>'score')::numeric, (s->>'max')::numeric);
  end loop;
  return new_exam_id;
end $$;
