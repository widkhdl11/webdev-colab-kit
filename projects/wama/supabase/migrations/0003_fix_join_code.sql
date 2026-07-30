-- 0003: 참여 코드 생성을 core 함수(gen_random_uuid)로 전환.
-- 버그: gen_random_bytes(pgcrypto)는 Supabase에서 extensions 스키마에 있어, search_path=public 인
-- security definer 함수에서 보이지 않아 create_academy_and_join/regenerate_join_code 가 런타임 실패했다.
-- gen_random_uuid 는 core(어느 search_path에서나 가용). 12 hex(=48bit) 코드 길이 유지 (INV-A6).

create or replace function create_academy_and_join(
  academy_name text,
  teacher_name text default null,
  branch       text default null,
  phone        text default null
) returns academy
  language plpgsql security definer set search_path = public as $$
declare
  a academy;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if exists (select 1 from teacher where id = auth.uid()) then
    raise exception 'already belongs to an academy';
  end if;
  insert into academy(name, join_code, branch, phone)
    values (academy_name, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), branch, phone)
    returning * into a;
  insert into teacher(id, academy_id, name) values (auth.uid(), a.id, teacher_name);
  return a;
end $$;

create or replace function regenerate_join_code()
  returns text
  language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  aid uuid := current_academy_id();
begin
  if aid is null then raise exception 'no academy'; end if;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  update academy set join_code = new_code where id = aid;
  return new_code;
end $$;
