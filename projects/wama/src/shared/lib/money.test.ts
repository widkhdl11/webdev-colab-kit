import { describe, it, expect } from "vitest";
import { isIntegerAmount, formatWon } from "./money";

// 원 단위 정수 금액 규칙의 단일 구현. 도메인(수강료·가격표)마다 상한만 다르게 넘겨 쓴다 —
// 같은 규칙을 두 군데 손으로 적으면 한쪽만 고쳐지고 금액이 갈라진다.
describe("isIntegerAmount", () => {
  it("0 이상 정수는 통과", () => {
    expect(isIntegerAmount(0, 100)).toBe(true);
    expect(isIntegerAmount(100, 100)).toBe(true);
  });

  it("소수·음수는 거부 — 부동소수 오차가 청구액에 섞이면 안 된다", () => {
    expect(isIntegerAmount(1.5, 100)).toBe(false);
    expect(isIntegerAmount(-1, 100)).toBe(false);
    expect(isIntegerAmount(0.1 + 0.2, 100)).toBe(false);
  });

  it("상한 초과·수가 아닌 값은 거부", () => {
    expect(isIntegerAmount(101, 100)).toBe(false);
    expect(isIntegerAmount(Number.NaN, 100)).toBe(false);
    expect(isIntegerAmount(Number.POSITIVE_INFINITY, 100)).toBe(false);
  });
});

describe("formatWon", () => {
  it("천 단위 콤마 + '원' (스펙 F8: 한글 병기 없음)", () => {
    expect(formatWon(450000)).toBe("450,000원");
    expect(formatWon(0)).toBe("0원");
    expect(formatWon(1000000)).toBe("1,000,000원");
  });

  it("세 자리 미만은 콤마 없이", () => {
    expect(formatWon(900)).toBe("900원");
  });
});
