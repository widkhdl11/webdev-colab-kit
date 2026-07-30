-- 0004: SECURITY DEFINER 함수 search_path 강화 (pg_temp 섀도잉 차단).
-- 취약점(행동 검증으로 확인): `set search_path = public` 은 relation 조회에서 pg_temp 를
-- 먼저 탐색하는 것을 막지 못한다. 인증 사용자가 `create temp table teacher(...)` 로
-- current_academy_id() 를 위조 → 모든 RLS(academy_id = current_academy_id())가 뚫려 격리 우회.
-- 수정: 정의자 함수 search_path='' + 모든 relation/타입/공개함수를 스키마 한정.
-- (pg_catalog 함수 now/upper/substr/replace/gen_random_uuid 는 빈 search_path에서도 자동 해석)

create or replace function public.current_academy_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select academy_id from public.teacher where id = auth.uid()
$$;

create or replace function public.evaluation_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_teacher_id := auth.uid();
    new.academy_id := public.current_academy_id();
  elsif tg_op = 'UPDATE' then
    new.author_teacher_id := old.author_teacher_id;
    new.academy_id := old.academy_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.create_academy_and_join(
  academy_name text,
  teacher_name text default null,
  branch       text default null,
  phone        text default null
) returns public.academy
  language plpgsql security definer set search_path = '' as $$
declare
  a public.academy;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if exists (select 1 from public.teacher where id = auth.uid()) then
    raise exception 'already belongs to an academy';
  end if;
  insert into public.academy(name, join_code, branch, phone)
    values (academy_name, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), branch, phone)
    returning * into a;
  insert into public.teacher(id, academy_id, name) values (auth.uid(), a.id, teacher_name);
  return a;
end $$;

-- 참여 코드는 대문자로 저장되므로 입력을 upper 정규화(소문자 입력 실패 UX 수정 겸).
create or replace function public.join_academy(code text, teacher_name text default null)
  returns public.academy
  language plpgsql security definer set search_path = '' as $$
declare
  a public.academy;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if exists (select 1 from public.teacher where id = auth.uid()) then
    raise exception 'already belongs to an academy';
  end if;
  select * into a from public.academy where join_code = upper(code);
  if not found then raise exception 'invalid join code'; end if;
  insert into public.teacher(id, academy_id, name) values (auth.uid(), a.id, teacher_name);
  return a;
end $$;

create or replace function public.regenerate_join_code()
  returns text
  language plpgsql security definer set search_path = '' as $$
declare
  new_code text;
  aid uuid := public.current_academy_id();
begin
  if aid is null then raise exception 'no academy'; end if;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  update public.academy set join_code = new_code where id = aid;
  return new_code;
end $$;

-- 정책의 current_academy_id() 호출도 public. 한정 (방어적 심층).
drop policy if exists academy_select on public.academy;
create policy academy_select on public.academy for select to authenticated
  using (id = public.current_academy_id());

drop policy if exists teacher_select on public.teacher;
create policy teacher_select on public.teacher for select to authenticated
  using (academy_id = public.current_academy_id());

drop policy if exists teacher_update_self on public.teacher;
create policy teacher_update_self on public.teacher for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and academy_id = public.current_academy_id());

drop policy if exists student_all on public.student;
create policy student_all on public.student for all to authenticated
  using (academy_id = public.current_academy_id())
  with check (academy_id = public.current_academy_id());

drop policy if exists schedule_all on public.schedule;
create policy schedule_all on public.schedule for all to authenticated
  using (academy_id = public.current_academy_id())
  with check (academy_id = public.current_academy_id());

drop policy if exists evaluation_all on public.evaluation;
create policy evaluation_all on public.evaluation for all to authenticated
  using (academy_id = public.current_academy_id())
  with check (academy_id = public.current_academy_id());
