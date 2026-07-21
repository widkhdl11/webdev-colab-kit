import { describe, it, expect } from "vitest";
import { seedState } from "./seed";
import { contributeTo, createProject, balanceOf, findView } from "./store";

const NOW = 1_000_000_000_000;

describe("store: 인메모리 펀딩 동작 (model.ts 재사용)", () => {
  it("후원이 목표를 채우면 SUCCESS로 정산된다 (창작자 달성금 + 후원자 보상)", () => {
    const s = seedState(NOW);
    // f1: target 30000, raised 25500 → 민서가 4500 넣으면 100%
    const r = contributeTo(s, "f1", "민서", 4_500, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = findView(r.value, "f1");
    expect(v?.status).toBe("SUCCESS");
    expect(v?.raised).toBe(30_000);
    // 창작자 하늘: +달성금 30000
    expect(balanceOf(r.value, "하늘")).toBe(21_000 + 30_000);
    // 민서: -4500 + 보상 475(= floor(1500 * 9500/30000))
    expect(balanceOf(r.value, "민서")).toBe(12_500 - 4_500 + 475);
  });

  it("OPEN 미달 후원은 잔액 차감 + raised 증가만 한다", () => {
    const s = seedState(NOW);
    const r = contributeTo(s, "f4", "민서", 3_000, NOW); // f4 raised 25600 → 28600 (<40000)
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = findView(r.value, "f4");
    expect(v?.status).toBe("OPEN");
    expect(v?.raised).toBe(28_600);
    expect(balanceOf(r.value, "민서")).toBe(12_500 - 3_000);
  });

  it("창작자는 자기 펀딩에 참여할 수 없다", () => {
    const s = seedState(NOW);
    const r = contributeTo(s, "f1", "하늘", 1_000, NOW); // 하늘이 f1 창작자
    expect(r.ok).toBe(false);
  });

  it("상한(5000) 초과 후원은 거부된다", () => {
    const s = seedState(NOW);
    const r = contributeTo(s, "f4", "민서", 6_000, NOW);
    expect(r.ok).toBe(false);
  });

  it("개설하면 목록에 추가되고 창작자 잔액에서 보상풀이 예치된다", () => {
    const s = seedState(NOW);
    const r = createProject(
      s,
      { creator: "민서", title: "새 프로젝트", description: ["소개"], category: "취미", target: 10_000, rewardPool: 1_000, deadline: NOW + 10 * 86_400_000 },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state.projects.length).toBe(s.projects.length + 1);
    expect(balanceOf(r.value.state, "민서")).toBe(12_500 - 1_000);
    const v = findView(r.value.state, r.value.id);
    expect(v?.status).toBe("OPEN");
    expect(v?.raised).toBe(0);
  });
});
