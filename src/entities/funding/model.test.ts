import { describe, it, expect } from "vitest";
import {
  openFunding,
  contribute,
  settleExpired,
  totalPoints,
  CAP,
  type World,
  type Funding,
  type Contribution,
  type FundingStatus,
} from "./model";

// 결정론을 위해 now는 항상 인자로 주입한다 (Date.now 미사용).
const NOW = 1_000_000_000_000;
const FUTURE = NOW + 100_000;
const PAST = NOW - 1;

function mkWorld(p: {
  balances: Record<string, number>;
  target: number;
  rewardPool?: number;
  raised?: number;
  status?: FundingStatus;
  contributions?: Contribution[];
  creator?: string;
  deadline?: number;
}): World {
  const funding: Funding = {
    id: "f1",
    creator: p.creator ?? "creator",
    target: p.target,
    rewardPool: p.rewardPool ?? 0,
    deadline: p.deadline ?? FUTURE,
    status: p.status ?? "OPEN",
    raised: p.raised ?? 0,
    contributions: p.contributions ?? [],
  };
  return { balances: { ...p.balances }, funding };
}

describe("포인트 펀딩 엔진", () => {
  it("S1 (INV-BAL-1, INV-BAL-2): 잔액/상한 초과 참여는 거절되고 상태 불변", () => {
    const w = mkWorld({ balances: { alice: 500, creator: 0 }, target: 10_000 });

    // 잔액 초과
    const over = contribute(w, "alice", 600, NOW);
    expect(over.ok).toBe(false);

    // CAP 초과 (잔액은 충분해도)
    const rich = mkWorld({ balances: { bob: 100_000, creator: 0 }, target: 100_000 });
    expect(contribute(rich, "bob", CAP + 1, NOW).ok).toBe(false);

    // 0/음수 금액
    expect(contribute(rich, "bob", 0, NOW).ok).toBe(false);

    // 거절 시 입력 상태 불변 (INV-BAL-1)
    expect(w.funding.raised).toBe(0);
    expect(w.balances.alice).toBe(500);
  });

  it("S2 (INV-BAL-2, INV-FUND-3): 목표 초과분은 거절, 정확히 100%면 SUCCESS", () => {
    const base = mkWorld({
      balances: { bob: 10_000, creator: 0 },
      target: 1_000,
      raised: 900,
      contributions: [{ funder: "x", amount: 900 }],
    });

    // 남은 100 초과 → 거절
    expect(contribute(base, "bob", 200, NOW).ok).toBe(false);

    // 정확히 100 → SUCCESS
    const r = contribute(base, "bob", 100, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.funding.raised).toBe(1_000);
      expect(r.value.funding.status).toBe("SUCCESS");
    }
  });

  it("S3 (INV-FUND-3, INV-SET-1, INV-SET-2): 성공 정산 + 총량 보존", () => {
    const opened = openFunding(
      { creator: 300, A: 600, B: 400 },
      { id: "f1", creator: "creator", target: 1_000, rewardPool: 300, deadline: FUTURE },
      NOW,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // 개설 시 보상풀 잠금 → 창작자 잔액 0
    expect(opened.value.balances.creator).toBe(0);

    const a = contribute(opened.value, "A", 600, NOW);
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const before = totalPoints(a.value);
    const b = contribute(a.value, "B", 400, NOW);
    expect(b.ok).toBe(true);
    if (!b.ok) return;

    expect(b.value.funding.status).toBe("SUCCESS");
    // 창작자 달성금 = T
    expect(b.value.balances.creator).toBe(1_000);
    // 보상 지분비율: A 300*600/1000=180, B 120
    expect(b.value.balances.A).toBe(180);
    expect(b.value.balances.B).toBe(120);
    // 총량 보존
    expect(totalPoints(b.value)).toBe(before);
    expect(totalPoints(b.value)).toBe(1_300);
  });

  it("S4 (INV-SET-2): 보상 반올림 잔여는 소수부 큰 순으로 배분, 합 == R", () => {
    const opened = openFunding(
      { creator: 100, a: 333, b: 333, c: 334 },
      { id: "f1", creator: "creator", target: 1_000, rewardPool: 100, deadline: FUTURE },
      NOW,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    let w = opened.value;
    for (const [u, amt] of [["a", 333], ["b", 333], ["c", 334]] as const) {
      const r = contribute(w, u, amt, NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      w = r.value;
    }
    expect(w.funding.status).toBe("SUCCESS");
    // floor: 33/33/33 (합99), 잔여 1P → 소수부 최대(c=0.4) → 34
    expect(w.balances.a).toBe(33);
    expect(w.balances.b).toBe(33);
    expect(w.balances.c).toBe(34);
    expect(w.balances.a + w.balances.b + w.balances.c).toBe(100); // Σreward == R
  });

  it("S5 (INV-FUND-4, INV-SET-3): 마감 미달성 → 기여금 소각, 보상풀 창작자 반환", () => {
    const w = mkWorld({
      balances: { creator: 0, c1: 0 },
      target: 1_000,
      rewardPool: 300,
      raised: 700,
      contributions: [{ funder: "c1", amount: 700 }],
      deadline: PAST,
    });
    const before = totalPoints(w);
    expect(before).toBe(1_000); // 0 + raised700 + pool300

    const r = settleExpired(w, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.funding.status).toBe("FAILED");
    expect(r.value.balances.creator).toBe(300); // 보상풀 반환
    expect(r.value.balances.c1).toBe(0); // 후원자 환불 없음(소각)
    // 시스템 총량은 소각분(raised=700)만큼 감소
    expect(totalPoints(r.value)).toBe(before - 700);
  });

  it("S6 (INV-FUND-2): 종료된 펀딩은 추가 참여/재정산 무효(멱등)", () => {
    const done = mkWorld({
      balances: { bob: 10_000, creator: 5_000 },
      target: 1_000,
      raised: 1_000,
      status: "SUCCESS",
    });
    expect(contribute(done, "bob", 10, NOW).ok).toBe(false);
    // 재정산은 항상 ok이고 상태·잔액 불변 (멱등 계약 단일 경로)
    const re = settleExpired(done, NOW + 1_000_000);
    expect(re.ok).toBe(true);
    if (re.ok) {
      expect(re.value.funding.status).toBe("SUCCESS");
      expect(re.value.balances.creator).toBe(5_000);
    }

    // FAILED 상태도 동일하게 무효
    const failed = mkWorld({
      balances: { bob: 10_000, creator: 0 },
      target: 1_000,
      raised: 500,
      status: "FAILED",
    });
    expect(contribute(failed, "bob", 10, NOW).ok).toBe(false);
    const re2 = settleExpired(failed, NOW + 1_000_000);
    expect(re2.ok).toBe(true);
    if (re2.ok) expect(re2.value.funding.status).toBe("FAILED");
  });

  it("S7 (INV-CONC-1, INV-FUND-3): 100% 근처 순차 적용 시 raised는 T를 넘지 않음", () => {
    const w = mkWorld({
      balances: { p1: 10_000, p2: 10_000, creator: 0 },
      target: 1_000,
      raised: 990,
      contributions: [{ funder: "x", amount: 990 }],
    });
    const r1 = contribute(w, "p1", 10, NOW);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.funding.raised).toBe(1_000);
    expect(r1.value.funding.status).toBe("SUCCESS");

    // 갱신된 최신 상태에 두 번째 참여 → 남은 0 / 종료 → 거절
    const r2 = contribute(r1.value, "p2", 10, NOW);
    expect(r2.ok).toBe(false);
    expect(r1.value.funding.raised).toBe(1_000); // 절대 초과 없음
    // (진짜 동시성은 Postgres 트랜잭션이 '최신 상태' 원자성으로 보장 — 통합 단계)
  });

  it("S8 (INV-SELF-1): 창작자는 자기 펀딩에 참여 불가", () => {
    const w = mkWorld({ balances: { creator: 10_000 }, target: 1_000, creator: "creator" });
    expect(contribute(w, "creator", 100, NOW).ok).toBe(false);
  });

  it("S9 (INV-FUND-1): 개설 조건 위반은 거절", () => {
    const params = { id: "f1", creator: "creator", target: 1_000, rewardPool: 300, deadline: FUTURE };
    // 잔액 < 보상풀
    expect(openFunding({ creator: 200 }, params, NOW).ok).toBe(false);
    // 목표 <= 0
    expect(openFunding({ creator: 1_000 }, { ...params, target: 0 }, NOW).ok).toBe(false);
    // 마감이 과거
    expect(openFunding({ creator: 1_000 }, { ...params, deadline: PAST }, NOW).ok).toBe(false);
  });

  it("S10 (INV-FUND-4): 마감 이후 도착한 참여는 거절", () => {
    const w = mkWorld({ balances: { bob: 10_000, creator: 0 }, target: 1_000, deadline: PAST });
    expect(contribute(w, "bob", 100, NOW).ok).toBe(false);
  });

  it("S11 (INV-ACC-1): 모든 상태 변경은 반환값으로만 — 전이 함수는 입력을 변형하지 않는다", () => {
    // 잔액·raised를 직접 쓸 경로가 없음을 순수성(입력 불변)으로 보장.
    // (클라이언트/서버 강제 경계는 rules/supabase.md + security-reviewer가 담당)
    const w = mkWorld({ balances: { bob: 10_000, creator: 0 }, target: 1_000 });
    const snapshotBal = w.balances.bob;
    const snapshotRaised = w.funding.raised;

    const r = contribute(w, "bob", 100, NOW);
    expect(r.ok).toBe(true);
    // 원본 불변
    expect(w.balances.bob).toBe(snapshotBal);
    expect(w.funding.raised).toBe(snapshotRaised);
    // 변경은 반환된 새 상태에만
    if (r.ok) {
      expect(r.value.balances.bob).toBe(snapshotBal - 100);
      expect(r.value.funding.raised).toBe(snapshotRaised + 100);
    }

    // openFunding / settleExpired 도 입력을 변형하지 않는다
    const bals = { creator: 500 };
    openFunding(bals, { id: "f1", creator: "creator", target: 1_000, rewardPool: 300, deadline: FUTURE }, NOW);
    expect(bals.creator).toBe(500);

    const exp = mkWorld({ balances: { creator: 0 }, target: 1_000, rewardPool: 300, raised: 700, deadline: PAST });
    settleExpired(exp, NOW);
    expect(exp.funding.status).toBe("OPEN");
    expect(exp.balances.creator).toBe(0);
  });

  it("S12 (INV-SET-2): 반올림 동률 시 잔여는 먼저 참여한 후원자에게", () => {
    const opened = openFunding(
      { creator: 1, p: 500, q: 500 },
      { id: "f1", creator: "creator", target: 1_000, rewardPool: 1, deadline: FUTURE },
      NOW,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const a = contribute(opened.value, "p", 500, NOW); // p가 먼저
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = contribute(a.value, "q", 500, NOW);
    expect(b.ok).toBe(true);
    if (!b.ok) return;

    // exact 0.5/0.5, floor 0/0, 잔여 1P → 동률이므로 먼저 참여한 p
    expect(b.value.balances.p).toBe(1);
    expect(b.value.balances.q).toBe(0);
    expect(b.value.balances.p + b.value.balances.q).toBe(1); // Σreward == R
  });

  it("S13 (INV-FUND-1, INV-FUND-4): 마감 경계 now==D 처리", () => {
    // 개설: deadline == now → 미래 아님 → 거절
    expect(
      openFunding({ creator: 0 }, { id: "f1", creator: "creator", target: 1_000, rewardPool: 0, deadline: NOW }, NOW).ok,
    ).toBe(false);

    // 참여: now == deadline → 마감(≥D)으로 거절
    const w = mkWorld({ balances: { bob: 10_000, creator: 0 }, target: 1_000, deadline: NOW });
    expect(contribute(w, "bob", 100, NOW).ok).toBe(false);

    // 정산: now == deadline & 미달성 → FAILED
    const r = settleExpired(w, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.funding.status).toBe("FAILED");
  });

  it("S14 (INV-BAL-2, INV-FUND-1): 음수·소수 금액/파라미터는 거절", () => {
    const w = mkWorld({ balances: { bob: 10_000, creator: 0 }, target: 1_000 });
    expect(contribute(w, "bob", -5, NOW).ok).toBe(false);
    expect(contribute(w, "bob", 100.5, NOW).ok).toBe(false);

    const params = { id: "f1", creator: "creator", target: 1_000, rewardPool: 300, deadline: FUTURE };
    expect(openFunding({ creator: 1_000 }, { ...params, rewardPool: -1 }, NOW).ok).toBe(false);
    expect(openFunding({ creator: 1_000 }, { ...params, target: 100.5 }, NOW).ok).toBe(false);
  });
});
