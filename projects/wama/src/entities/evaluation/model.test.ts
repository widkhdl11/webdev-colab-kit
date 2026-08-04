import { describe, it, expect } from "vitest";
import { groupByMonth, type Evaluation } from "./model";

// 평가를 "년.월"로 묶는 규칙. 한 달 = 평가 한 묶음의 단위(DECISIONS 2026-07-24).
// 이 규칙이 화면 안에 있으면 다른 화면이 같은 묶기를 다시 구현해 어긋난다 —
// 시간표에서 실제로 겪은 병이다(편집 1줄 / 상세 2줄, 2026-08-04). 그래서 entities 에 한 벌만 둔다.

const ev = (id: string, month: string, subject: string): Evaluation =>
  ({ id, month, subject, teacher: "김선생", body: "본문" });

describe("groupByMonth", () => {
  it("같은 달의 평가를 한 묶음으로 모은다", () => {
    const g = groupByMonth([ev("1", "2026.08", "수학"), ev("2", "2026.08", "논술")]);
    expect(g).toHaveLength(1);
    expect(g[0]?.items.map((e) => e.subject)).toEqual(["수학", "논술"]);
  });

  it("월 순서는 입력 순서를 그대로 지킨다 — repo 가 최신월 우선으로 주기 때문", () => {
    const g = groupByMonth([ev("1", "2026.08", "수학"), ev("2", "2026.07", "논술"), ev("3", "2026.08", "영어")]);
    expect(g.map((x) => x.month)).toEqual(["2026.08", "2026.07"]);
  });

  it("떨어져 있던 같은 달도 처음 나온 자리에 합친다", () => {
    const g = groupByMonth([ev("1", "2026.08", "수학"), ev("2", "2026.07", "논술"), ev("3", "2026.08", "영어")]);
    expect(g[0]?.items.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("묶음 안 순서도 입력 순서를 지킨다", () => {
    const g = groupByMonth([ev("1", "2026.08", "수학"), ev("2", "2026.08", "논술")]);
    expect(g[0]?.items.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("빈 목록은 빈 배열", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
