-- 0002: academy 프로필 필드(지점명·전화번호)
-- 격리 단위는 학원이며 지점은 academy의 표시 필드(결정 2026-07-24, DECISIONS).
-- auth-isolation 격리 정확성과 무관한 프로필 컬럼 — RLS/정책은 0001 그대로 유효.

alter table academy add column if not exists branch text;
alter table academy add column if not exists phone  text;

-- 가입 RPC를 프로필 필드까지 받도록 확장 (기존 2인자 시그니처는 드롭).
drop function if exists create_academy_and_join(text, text);
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
    values (academy_name, upper(encode(gen_random_bytes(6), 'hex')), branch, phone)
    returning * into a;
  insert into teacher(id, academy_id, name) values (auth.uid(), a.id, teacher_name);
  return a;
end $$;
