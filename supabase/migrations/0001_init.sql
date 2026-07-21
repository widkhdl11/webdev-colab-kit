-- 포인트 펀딩 — 스키마 + 서버 강제 RPC (docs/specs/funding.md 이식).
-- 원칙: 모든 금융 연산은 이 RPC(SECURITY DEFINER, 단일 트랜잭션, 행 잠금)에서만.
-- 클라이언트는 테이블을 직접 write 못 함(RLS: select만 허용, insert/update/delete 정책 없음 → INV-ACC-1).

-- ── 테이블 ──────────────────────────────────────────────
create table if not exists app_user (
  nickname text primary key,
  balance  integer not null check (balance >= 0)          -- INV-BAL-1
);

create table if not exists funding (
  id          text primary key,
  creator     text not null references app_user(nickname),
  title       text not null,
  description text[] not null default '{}',
  category    text not null,
  target      integer not null check (target > 0),         -- INV-FUND-1
  reward_pool integer not null check (reward_pool >= 0),
  deadline    timestamptz not null,
  status      text not null default 'OPEN' check (status in ('OPEN','SUCCESS','FAILED')),
  raised      integer not null default 0 check (raised >= 0 and raised <= target), -- INV-BAL-2 상한
  created_at  timestamptz not null default now()
);
create index if not exists funding_status_idx on funding(status);

create table if not exists contribution (
  id         bigint generated always as identity primary key,
  funding_id text not null references funding(id),
  funder     text not null references app_user(nickname),
  amount     integer not null check (amount > 0),
  seq        integer not null,                             -- 참여 순서(정산 반올림 tie-break)
  created_at timestamptz not null default now()
);
create index if not exists contribution_funding_idx on contribution(funding_id);

-- ── RLS: 읽기만 허용, 쓰기 정책 없음(직접 write 차단) ──────
alter table app_user     enable row level security;
alter table funding      enable row level security;
alter table contribution enable row level security;
drop policy if exists read_app_user on app_user;
drop policy if exists read_funding on funding;
drop policy if exists read_contribution on contribution;
create policy read_app_user     on app_user     for select using (true);
create policy read_funding      on funding      for select using (true);
create policy read_contribution on contribution for select using (true);

-- ── RPC: 개설 (INV-FUND-1) ──────────────────────────────
create or replace function open_funding(
  p_creator text, p_title text, p_description text[], p_category text,
  p_target integer, p_reward integer, p_deadline timestamptz
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_bal integer; v_id text;
begin
  if p_target is null or p_target < 1 then return jsonb_build_object('ok',false,'error','목표는 양의 정수여야 해요'); end if;
  if p_reward is null or p_reward < 0 then return jsonb_build_object('ok',false,'error','보상풀은 음이 아닌 정수여야 해요'); end if;
  if p_deadline is null or p_deadline <= now() then return jsonb_build_object('ok',false,'error','마감은 미래여야 해요'); end if;

  select balance into v_bal from app_user where nickname = p_creator for update;
  if v_bal is null then return jsonb_build_object('ok',false,'error','존재하지 않는 사용자'); end if;
  if v_bal < p_reward then return jsonb_build_object('ok',false,'error','창작자 잔액이 보상풀보다 적어요'); end if;

  v_id := 'p' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  update app_user set balance = balance - p_reward where nickname = p_creator;   -- 보상풀 잠금
  insert into funding(id, creator, title, description, category, target, reward_pool, deadline, status, raised)
  values (v_id, p_creator, p_title, coalesce(p_description,'{}'), p_category, p_target, p_reward, p_deadline, 'OPEN', 0);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ── RPC: 참여 (INV-BAL-2 / FUND-2·3·4 / SELF-1 / CONC-1 / SET-1·2) ──
create or replace function contribute(
  p_funding_id text, p_funder text, p_amount integer
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare f funding%rowtype; v_bal integer; v_max integer; v_leftover integer;
begin
  select * into f from funding where id = p_funding_id for update;           -- 펀딩 행 잠금(원자성)
  if not found then return jsonb_build_object('ok',false,'error','존재하지 않는 펀딩'); end if;

  -- 지연 마감 평가(INV-FUND-4): 마감 지났으면 그 자리에서 FAILED 정산 후 거절
  if f.status = 'OPEN' and now() >= f.deadline then
    update app_user set balance = balance + f.reward_pool where nickname = f.creator; -- INV-SET-3 보상풀 반환
    update funding set status = 'FAILED' where id = f.id;                              -- 기여금은 소각(불변)
    return jsonb_build_object('ok',false,'error','마감된 펀딩');
  end if;

  if f.status <> 'OPEN' then return jsonb_build_object('ok',false,'error','이미 종료된 펀딩'); end if;         -- INV-FUND-2
  if p_funder = f.creator then return jsonb_build_object('ok',false,'error','창작자는 자기 펀딩에 참여할 수 없어요'); end if; -- INV-SELF-1
  if p_amount is null or p_amount < 1 then return jsonb_build_object('ok',false,'error','참여 금액은 양의 정수여야 해요'); end if;

  select balance into v_bal from app_user where nickname = p_funder for update;
  if v_bal is null then return jsonb_build_object('ok',false,'error','존재하지 않는 사용자'); end if;

  v_max := least(5000, v_bal, f.target - f.raised);                          -- INV-BAL-2 (CAP·잔액·남은목표)
  if p_amount > v_max then return jsonb_build_object('ok',false,'error','참여 금액이 상한(잔액/CAP/남은 목표)을 초과해요'); end if;

  update app_user set balance = balance - p_amount where nickname = p_funder;        -- 차감 (INV-BAL-1)
  insert into contribution(funding_id, funder, amount, seq)
  values (p_funding_id, p_funder, p_amount,
          coalesce((select max(seq) from contribution where funding_id = p_funding_id), 0) + 1);
  update funding set raised = raised + p_amount where id = f.id;

  if f.raised + p_amount = f.target then                                     -- INV-FUND-3: 정확히 100%
    update app_user set balance = balance + f.target where nickname = f.creator;      -- INV-SET-1 달성금
    -- INV-SET-2: reward_i = floor(R×c_i/T), 잔여는 소수부 큰 순(동률은 먼저 참여 순)
    v_leftover := f.reward_pool - (
      select coalesce(sum((f.reward_pool::bigint * c) / f.target), 0)
      from (select sum(amount) c from contribution where funding_id = f.id group by funder) s
    );
    with totals as (
      select funder, sum(amount) c, min(seq) first_seq
      from contribution where funding_id = f.id group by funder
    ),
    calc as (
      select funder,
             ((f.reward_pool::bigint * c) / f.target)::int as base,
             (f.reward_pool::bigint * c) % f.target as rem_num,
             first_seq
      from totals
    ),
    ranked as (
      select funder, base, row_number() over (order by rem_num desc, first_seq asc) rn from calc
    )
    update app_user u
       set balance = balance + r.base + case when r.rn <= v_leftover then 1 else 0 end
      from ranked r where u.nickname = r.funder;
    update funding set status = 'SUCCESS' where id = f.id;
    return jsonb_build_object('ok', true, 'status', 'SUCCESS');
  end if;

  return jsonb_build_object('ok', true, 'status', 'OPEN');
end $$;

-- ── RPC: 마감 일괄 정산(지연 평가 보조, 멱등) INV-FUND-4 / SET-3 ──
create or replace function settle_expired_all() returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r funding%rowtype;
begin
  for r in select * from funding where status = 'OPEN' and now() >= deadline for update loop
    update app_user set balance = balance + r.reward_pool where nickname = r.creator;
    update funding set status = 'FAILED' where id = r.id;
  end loop;
end $$;

-- ── 실행 권한(anon) — 쓰기는 이 함수들로만 ──────────────
grant select on app_user, funding, contribution to anon;
grant execute on function open_funding(text,text,text[],text,integer,integer,timestamptz) to anon;
grant execute on function contribute(text,text,integer) to anon;
grant execute on function settle_expired_all() to anon;
