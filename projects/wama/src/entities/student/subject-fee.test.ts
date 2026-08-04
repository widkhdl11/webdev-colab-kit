import { describe, it, expect } from "vitest";
import {
  parseSubjectFee,
  validateSubjectFee,
  toOverrideList,
  diffOverrides,
  type StudentSubjectFee,
} from "./subject-fee";

// 학생별 과목 금액 예외 — 형제 감면·개별 할인을 표현하는 자리.
// docs/specs/payment-notice-export.md (approved): 한 과목의 금액 = 학생별 예외가 있으면 그것, 없으면 가격표 값.
// 합계는 여전히 자동이라 과목을 끊으면 금액이 따라 내려간다(총액 고정이 아니다).

const fee = (subjectId: string, subject: string, monthlyFee: number): StudentSubjectFee => ({
  id: `f-${subjectId}`,
  subjectId,
  subject,
  monthlyFee,
});

describe("parseSubjectFee — 서버 응답을 도메인 값으로", () => {
  it("중첩된 과목명을 펴서 승격한다", () => {
    expect(
      parseSubjectFee({ id: "f1", subject_id: "s1", monthly_fee: 220000, subject: { name: "수학" } }),
    ).toEqual({ id: "f1", subjectId: "s1", subject: "수학", monthlyFee: 220000 });
  });

  it("과목명·금액이 빠지거나 형식이 틀리면 던진다", () => {
    expect(() => parseSubjectFee({ id: "f1", subject_id: "s1", monthly_fee: 1 })).toThrow();
    expect(() => parseSubjectFee({ id: "f1", subject_id: "s1", monthly_fee: "1", subject: { name: "수학" } })).toThrow();
    expect(() => parseSubjectFee(null)).toThrow();
  });
});

describe("validateSubjectFee — 저장 전 검증 (INV-PN2)", () => {
  it("0 이상 정수는 통과 — 0은 면제 학생을 표현한다", () => {
    expect(validateSubjectFee(0)).toBeUndefined();
    expect(validateSubjectFee(220000)).toBeUndefined();
  });

  it("소수·음수·상한 초과는 거부", () => {
    expect(validateSubjectFee(-1)).toBeDefined();
    expect(validateSubjectFee(1000.5)).toBeDefined();
    expect(validateSubjectFee(10_000_001)).toBeDefined();
  });
});

describe("toOverrideList — tuition 계산에 넘길 모양으로", () => {
  it("과목명 + 금액만 남긴다 (tuition 은 id 를 모른다)", () => {
    expect(toOverrideList([fee("s1", "수학", 220000), fee("s2", "논술", 100000)])).toEqual([
      { subject: "수학", monthlyFee: 220000 },
      { subject: "논술", monthlyFee: 100000 },
    ]);
  });

  it("빈 목록은 빈 배열", () => {
    expect(toOverrideList([])).toEqual([]);
  });
});

describe("diffOverrides — 폼 저장 시 무엇을 넣고 빼고 고칠지", () => {
  const saved = [fee("s1", "수학", 220000), fee("s2", "논술", 100000)];

  it("빈칸으로 지운 과목은 삭제 대상", () => {
    const d = diffOverrides(saved, new Map([["s1", 220000]]));
    expect(d.removed.map((f) => f.subjectId)).toEqual(["s2"]);
    expect(d.updated).toEqual([]);
    expect(d.added).toEqual([]);
  });

  it("금액이 바뀐 과목만 갱신 대상 (안 바뀐 건 건드리지 않는다)", () => {
    const d = diffOverrides(saved, new Map([["s1", 200000], ["s2", 100000]]));
    expect(d.updated.map((u) => [u.id, u.monthlyFee])).toEqual([["f-s1", 200000]]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("없던 과목에 금액을 넣으면 추가 대상", () => {
    const d = diffOverrides(saved, new Map([["s1", 220000], ["s2", 100000], ["s3", 90000]]));
    expect(d.added).toEqual([{ subjectId: "s3", monthlyFee: 90000 }]);
  });

  it("전부 비우면 전부 삭제", () => {
    const d = diffOverrides(saved, new Map());
    expect(d.removed).toHaveLength(2);
  });

  it("0원 예외는 '없음'이 아니라 '0원 청구'다 — 삭제와 구분한다", () => {
    const d = diffOverrides(saved, new Map([["s1", 0], ["s2", 100000]]));
    expect(d.removed).toEqual([]);
    expect(d.updated.map((u) => u.monthlyFee)).toEqual([0]);
  });
});
