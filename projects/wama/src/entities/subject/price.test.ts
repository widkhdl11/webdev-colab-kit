import { describe, it, expect } from "vitest";
import {
  MAX_SUBJECT_FEE,
  MAX_SESSIONS_PER_WEEK,
  parseSubjectPrice,
  validateSubjectPrice,
  sortPrices,
  pricesForSubject,
  type SubjectPrice,
} from "./price";

// 과목 가격표 = (과목 × 주 횟수) → 월정액. docs/specs/payment-notice-export.md (approved) 의 "금액이 정해지는 방식".
// 이 값이 학생 청구액의 원천이므로 규칙이 틀리면 곧 돈이 틀린다.
// 계산·합산은 entities/tuition 몫이고, 여기는 **저장되는 한 줄**의 파싱·검증만 맡는다.

const row = (subject: string, sessionsPerWeek: number, monthlyFee: number): SubjectPrice => ({
  id: `${subject}-${sessionsPerWeek}`,
  // 과목명에서 파생 — 과목이 다르면 id 도 달라야 subjectId 필터를 제대로 검증한다
  subjectId: `id-${subject}`,
  subject,
  sessionsPerWeek,
  monthlyFee,
});

describe("parseSubjectPrice — 서버 응답을 도메인 값으로", () => {
  it("중첩된 subject 이름까지 펴서 승격한다", () => {
    expect(
      parseSubjectPrice({
        id: "p1",
        subject_id: "s1",
        sessions_per_week: 3,
        monthly_fee: 250000,
        subject: { name: "수학" },
      }),
    ).toEqual({ id: "p1", subjectId: "s1", subject: "수학", sessionsPerWeek: 3, monthlyFee: 250000 });
  });

  it("과목명이 없으면 던진다 — 이름 없는 가격은 어느 과목 것인지 알 수 없다", () => {
    expect(() => parseSubjectPrice({ id: "p1", subject_id: "s1", sessions_per_week: 3, monthly_fee: 1 })).toThrow();
  });

  it("금액·횟수가 수가 아니면 던진다", () => {
    const base = { id: "p1", subject_id: "s1", subject: { name: "수학" } };
    expect(() => parseSubjectPrice({ ...base, sessions_per_week: "3", monthly_fee: 1 })).toThrow();
    expect(() => parseSubjectPrice({ ...base, sessions_per_week: 3, monthly_fee: null })).toThrow();
  });

  it("객체가 아니면 던진다", () => {
    expect(() => parseSubjectPrice(null)).toThrow();
  });
});

describe("validateSubjectPrice — 저장 전 검증", () => {
  it("정상 입력은 통과", () => {
    expect(validateSubjectPrice({ sessionsPerWeek: 3, monthlyFee: 250000 })).toEqual({});
  });

  it("주 횟수는 1~7 — 0회는 수강이 아니고 8회는 요일 수를 넘는다", () => {
    expect(validateSubjectPrice({ sessionsPerWeek: 0, monthlyFee: 1 }).sessionsPerWeek).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: MAX_SESSIONS_PER_WEEK + 1, monthlyFee: 1 }).sessionsPerWeek).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: 1.5, monthlyFee: 1 }).sessionsPerWeek).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: MAX_SESSIONS_PER_WEEK, monthlyFee: 1 }).sessionsPerWeek).toBeUndefined();
  });

  it("금액은 0 이상 정수, 상한까지 (INV-PN2)", () => {
    expect(validateSubjectPrice({ sessionsPerWeek: 1, monthlyFee: -1 }).monthlyFee).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: 1, monthlyFee: 180000.5 }).monthlyFee).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: 1, monthlyFee: MAX_SUBJECT_FEE + 1 }).monthlyFee).toBeDefined();
    expect(validateSubjectPrice({ sessionsPerWeek: 1, monthlyFee: 0 }).monthlyFee).toBeUndefined();
  });

  it("둘 다 틀리면 둘 다 돌려준다", () => {
    expect(Object.keys(validateSubjectPrice({ sessionsPerWeek: 0, monthlyFee: -1 })).sort()).toEqual([
      "monthlyFee",
      "sessionsPerWeek",
    ]);
  });
});

describe("sortPrices — 표시 순서", () => {
  it("과목명 오름차순, 같은 과목 안에서는 주 횟수 오름차순", () => {
    const sorted = sortPrices([row("수학", 3, 3), row("논술", 1, 1), row("수학", 1, 2)]);
    expect(sorted.map((p) => [p.subject, p.sessionsPerWeek])).toEqual([
      ["논술", 1],
      ["수학", 1],
      ["수학", 3],
    ]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const input = [row("수학", 3, 3), row("논술", 1, 1)];
    sortPrices(input);
    expect(input[0]?.subject).toBe("수학");
  });
});

describe("pricesForSubject — 한 과목의 가격만 골라 주 횟수 순으로", () => {
  const all = [row("수학", 3, 250000), row("논술", 1, 120000), row("수학", 1, 100000)];

  it("해당 과목만, 주 횟수 오름차순", () => {
    const got = pricesForSubject(all, "id-수학").map((p) => p.sessionsPerWeek);
    expect(got).toEqual([1, 3]);
  });

  it("과목명이 같아도 id 가 다르면 걸러낸다 — 이름이 아니라 id 로 판단한다", () => {
    const mixed = [{ ...row("수학", 1, 100000), subjectId: "다른과목" }, row("수학", 3, 250000)];
    const got = pricesForSubject(mixed, "id-수학");
    expect(got).toHaveLength(1);
    expect(got[0]?.sessionsPerWeek).toBe(3);
  });

  it("없으면 빈 배열 (가격표에 아직 안 넣은 과목)", () => {
    expect(pricesForSubject(all, "없는id")).toEqual([]);
  });

  it("원본을 건드리지 않는다", () => {
    const input = [row("수학", 3, 250000), row("수학", 1, 100000)];
    pricesForSubject(input, "id-수학");
    expect(input[0]?.sessionsPerWeek).toBe(3);
  });
});
