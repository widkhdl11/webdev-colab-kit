// 포인트 펀딩 도메인 (순수 · I/O 없음). 불변식은 docs/specs/funding.md 참조.
// 실제 원자성·영속성은 shared/api의 Supabase RPC가 이 로직을 트랜잭션으로 감싼다.

export type UserId = string;
export type Points = number; // 음이 아닌 정수
export type FundingStatus = "OPEN" | "SUCCESS" | "FAILED";

export const CAP: Points = 5_000; // 1회 참여 상한 (스펙 확정 파라미터)
export const INITIAL_GRANT: Points = 10_000; // 데모 계정 초기 지급

export interface Contribution {
  funder: UserId;
  amount: Points;
}
export interface Funding {
  id: string;
  creator: UserId;
  target: Points; // T
  rewardPool: Points; // R
  deadline: number; // D, epoch ms
  status: FundingStatus;
  raised: Points;
  contributions: Contribution[];
}
export interface World {
  balances: Record<UserId, Points>;
  funding: Funding;
}
export interface OpenParams {
  id: string;
  creator: UserId;
  target: Points;
  rewardPool: Points;
  deadline: number;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const isPosInt = (n: number): boolean => Number.isInteger(n) && n > 0;
const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const balOf = (balances: Record<UserId, Points>, u: UserId): Points => balances[u] ?? 0;

// INV-FUND-1: 개설 조건 검증 후 보상풀 잠금(창작자 잔액 −= R)
export function openFunding(
  balances: Record<UserId, Points>,
  p: OpenParams,
  now: number,
): Result<World> {
  if (!isPosInt(p.target)) return fail("목표는 양의 정수여야 한다");
  if (!isNonNegInt(p.rewardPool)) return fail("보상풀은 음이 아닌 정수여야 한다");
  if (p.deadline <= now) return fail("마감은 미래여야 한다");
  const creatorBal = balOf(balances, p.creator);
  if (creatorBal < p.rewardPool) return fail("창작자 잔액이 보상풀보다 적다");

  const funding: Funding = {
    id: p.id,
    creator: p.creator,
    target: p.target,
    rewardPool: p.rewardPool,
    deadline: p.deadline,
    status: "OPEN",
    raised: 0,
    contributions: [],
  };
  return ok({
    balances: { ...balances, [p.creator]: creatorBal - p.rewardPool },
    funding,
  });
}

// INV-BAL-2 / INV-FUND-2·3·4 / INV-SELF-1: 참여 → 조건 충족 시 차감·지분 기록, 100%면 성공 정산
export function contribute(
  world: World,
  funder: UserId,
  amount: Points,
  now: number,
): Result<World> {
  const f = world.funding;
  if (f.status !== "OPEN") return fail("이미 종료된 펀딩이다"); // INV-FUND-2
  if (now >= f.deadline) return fail("마감된 펀딩이다"); // INV-FUND-4
  if (funder === f.creator) return fail("창작자는 자기 펀딩에 참여할 수 없다"); // INV-SELF-1
  if (!isPosInt(amount)) return fail("참여 금액은 양의 정수여야 한다"); // INV-BAL-2

  const bal = balOf(world.balances, funder);
  const remaining = f.target - f.raised;
  const max = Math.min(CAP, bal, remaining); // INV-BAL-2 (CAP·잔액·남은목표)
  if (amount > max) return fail("참여 금액이 상한(잔액/CAP/남은 목표)을 초과한다");

  const balances = { ...world.balances, [funder]: bal - amount }; // INV-BAL-1
  const funding: Funding = {
    ...f,
    raised: f.raised + amount,
    contributions: [...f.contributions, { funder, amount }],
  };

  // INV-FUND-3: raised == T 인 순간 성공 정산 1회
  if (funding.raised === f.target) return ok(settleSuccess(balances, funding));
  return ok({ balances, funding });
}

// INV-SET-1·2: 창작자 += T, 보상풀을 지분비율로 분배(총량 보존)
function settleSuccess(balances: Record<UserId, Points>, funding: Funding): World {
  const next = { ...balances };
  next[funding.creator] = balOf(next, funding.creator) + funding.target; // 달성금

  for (const [funder, reward] of distributeReward(funding)) {
    next[funder] = balOf(next, funder) + reward;
  }
  return { balances: next, funding: { ...funding, status: "SUCCESS" } };
}

// INV-SET-2: reward_i = floor(R×c_i/T), 잔여는 소수부 큰 순(동률은 먼저 참여한 순)으로 1P씩 → Σ == R
function distributeReward(funding: Funding): Map<UserId, Points> {
  const { rewardPool: R, target: T } = funding;
  const result = new Map<UserId, Points>();
  if (R === 0) return result;

  // 후원자별 기여 합산 + 최초 참여 순서 기록
  const totals = new Map<UserId, { c: Points; firstIdx: number }>();
  funding.contributions.forEach((con, idx) => {
    const cur = totals.get(con.funder);
    if (cur) cur.c += con.amount;
    else totals.set(con.funder, { c: con.amount, firstIdx: idx });
  });

  // 정수 산술만 사용 — reward_i = floor(R×c_i/T), 잔여 정렬 키는 정수 나머지 (R×c_i) mod T.
  // float 비교 의존과 rem 음수 가능성을 원천 제거한다.
  const rows = [...totals.entries()].map(([funder, { c, firstIdx }]) => ({
    funder,
    floor: Math.floor((R * c) / T),
    remainder: (R * c) % T,
    firstIdx,
  }));

  let rem = R - rows.reduce((s, r) => s + r.floor, 0);
  const order = [...rows].sort((a, b) => b.remainder - a.remainder || a.firstIdx - b.firstIdx);
  for (let i = 0; i < order.length && rem > 0; i++, rem--) order[i].floor += 1;

  for (const r of rows) result.set(r.funder, r.floor);
  return result;
}

// INV-FUND-4 / INV-SET-3: 마감 & 미달성 → FAILED. 기여금 소각, 보상풀 창작자 반환
export function settleExpired(world: World, now: number): Result<World> {
  const f = world.funding;
  if (f.status !== "OPEN") return ok(world); // 멱등 (INV-FUND-2)
  if (now < f.deadline) return fail("아직 마감 전이다");
  // raised는 T를 초과할 수 없고, ==T 였다면 이미 SUCCESS. 여기서는 raised < T.

  const balances = {
    ...world.balances,
    [f.creator]: balOf(world.balances, f.creator) + f.rewardPool, // 보상풀 반환
  };
  // 기여금(raised)은 어떤 계정에도 귀속되지 않고 소각된다.
  return ok({ balances, funding: { ...f, status: "FAILED" } });
}

// 시스템 총 포인트. OPEN 동안은 잠긴 escrow(raised)+보상풀(rewardPool)을 포함.
// 종료 후에는 escrow가 잔액으로 해소(성공)되거나 소각(실패)됐으므로 잔액 합만.
export function totalPoints(world: World): Points {
  const sumBal = Object.values(world.balances).reduce((a, b) => a + b, 0);
  if (world.funding.status === "OPEN") {
    return sumBal + world.funding.raised + world.funding.rewardPool;
  }
  return sumBal;
}
