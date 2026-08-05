import { describe, it, expect } from "vitest";
import {
  MAX_AMOUNT,
  isValidAmount,
  sessionsPerWeekBySubject,
  buildTuition,
  withAdHocFees,
  toNoticeStudent,
  noticeBlockers,
  parseFeeEdits,
  type SubjectPrice,
  type SubjectFeeOverride,
} from "./model";

// docs/specs/payment-notice-export.md (approved 2026-08-03) 의 불변식 단위 검증.
// 여기서 검증하는 것: INV-PN2(원 정수) · INV-PN3(개인정보 미포함) · INV-PN4(이름·대상월 필수)
//                    INV-PN5(내보내기 수정은 저장값 불변) · INV-PN6(미등록 조합 대체 금지) · INV-PN7(주 횟수 파생)
// INV-PN1(학원 격리)은 RLS 행동 검증이라 tests/inv/payment-notice-isolation.integration.test.ts.
//
// tuition 은 자족 슬라이스라 schedule·student 를 import 하지 않는다(FSD 동일 레이어 금지).
// 실제 ScheduleSlot 이 이 모양을 만족한다는 것은 배선 지점(features)의 타입검사가 보장한다.

interface TestSlot {
  readonly id: string;
  readonly subject: string;
  readonly weekday: string;
  readonly start: string;
  readonly end: string;
  readonly teacher: string;
}

const slot = (subject: string, weekday: string): TestSlot => ({
  id: `${subject}-${weekday}`,
  subject,
  weekday,
  start: "17:00",
  end: "18:30",
  teacher: "김선생",
});

const price = (subject: string, sessionsPerWeek: number, monthlyFee: number): SubjectPrice => ({
  subject,
  sessionsPerWeek,
  monthlyFee,
});

// 수학 월·수·금(주3회) + 논술 화(주1회)
const SLOTS: readonly TestSlot[] = [
  slot("수학", "월"),
  slot("수학", "수"),
  slot("수학", "금"),
  slot("논술", "화"),
];

const PRICES: readonly SubjectPrice[] = [
  price("수학", 3, 250_000),
  price("수학", 2, 180_000),
  price("논술", 1, 120_000),
];

describe("isValidAmount — 금액은 원 단위 정수 (INV-PN2)", () => {
  it("0 이상 정수만 통과한다", () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(450_000)).toBe(true);
    expect(isValidAmount(MAX_AMOUNT)).toBe(true);
  });

  it("소수·음수를 거부한다 — 부동소수 오차가 청구액에 섞이면 안 된다", () => {
    expect(isValidAmount(180_000.5)).toBe(false);
    expect(isValidAmount(-10_000)).toBe(false);
    expect(isValidAmount(0.1 + 0.2)).toBe(false);
  });

  it("상한을 넘거나 수가 아닌 값을 거부한다", () => {
    expect(isValidAmount(MAX_AMOUNT + 1)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("sessionsPerWeekBySubject — 주 횟수는 시간표에서 파생 (INV-PN7)", () => {
  it("같은 과목의 주간 슬롯 개수를 센다", () => {
    const m = sessionsPerWeekBySubject(SLOTS);
    expect(m.get("수학")).toBe(3);
    expect(m.get("논술")).toBe(1);
  });

  it("시간표가 비면 빈 결과 — 과목이 없으면 셀 것도 없다", () => {
    expect(sessionsPerWeekBySubject([]).size).toBe(0);
  });

  it("슬롯을 지우면 횟수가 즉시 따라 내려간다 (저장된 스냅샷이 아님)", () => {
    const withoutFriday = SLOTS.filter((s) => !(s.subject === "수학" && s.weekday === "금"));
    expect(sessionsPerWeekBySubject(withoutFriday).get("수학")).toBe(2);
  });
});

describe("buildTuition — 청구액 계산", () => {
  it("가격표에서 (과목, 주 횟수) 로 금액을 찾아 합산한다", () => {
    const b = buildTuition(SLOTS, PRICES, []);
    expect(b.lines.map((l) => [l.subject, l.sessionsPerWeek, l.monthlyFee])).toEqual([
      ["수학", 3, 250_000],
      ["논술", 1, 120_000],
    ]);
    expect(b.total).toBe(370_000);
  });

  it("시간표에서 슬롯이 빠지면 다른 횟수의 가격으로 자동 재계산된다 (INV-PN7)", () => {
    const withoutFriday = SLOTS.filter((s) => !(s.subject === "수학" && s.weekday === "금"));
    const b = buildTuition(withoutFriday, PRICES, []);
    expect(b.lines[0]?.monthlyFee).toBe(180_000); // 주3회 250,000 → 주2회 180,000
    expect(b.total).toBe(300_000);
  });

  it("학생별 예외가 있으면 가격표보다 우선한다 (형제 감면 등)", () => {
    const overrides: readonly SubjectFeeOverride[] = [{ subject: "수학", monthlyFee: 220_000 }];
    const b = buildTuition(SLOTS, PRICES, overrides);
    expect(b.lines[0]?.monthlyFee).toBe(220_000);
    expect(b.lines[0]?.source).toBe("override");
    expect(b.total).toBe(340_000);
  });

  it("예외가 걸린 과목을 끊으면 합계가 따라 내려간다 (총액 고정이 아님)", () => {
    const overrides: readonly SubjectFeeOverride[] = [{ subject: "수학", monthlyFee: 220_000 }];
    const onlyMath = SLOTS.filter((s) => s.subject === "수학");
    expect(buildTuition(onlyMath, PRICES, overrides).total).toBe(220_000);
  });

  it("가격표에 없는 조합은 0원이나 다른 횟수로 대체하지 않는다 (INV-PN6)", () => {
    // 수학 주4회 — 가격표엔 주3회·주2회만 있다.
    const fourTimes = [...SLOTS.filter((s) => s.subject === "수학"), slot("수학", "목")];
    const b = buildTuition(fourTimes, PRICES, []);
    const math = b.lines.find((l) => l.subject === "수학");
    expect(math?.sessionsPerWeek).toBe(4);
    expect(math?.monthlyFee).toBeNull();
    expect(math?.source).toBe("unpriced");
  });

  it("미확정 줄이 하나라도 있으면 합계는 확정되지 않는다 (INV-PN6)", () => {
    const b = buildTuition([...SLOTS, slot("사회", "토")], PRICES, []);
    expect(b.total).toBeNull(); // 370,000 으로 조용히 합산하면 실제보다 적게 청구된다
    expect(b.hasUnpriced).toBe(true);
  });

  it("시간표가 없으면 빈 내역·합계 0 (오류가 아님)", () => {
    const b = buildTuition([], PRICES, []);
    expect(b.lines).toEqual([]);
    expect(b.total).toBe(0);
    expect(b.hasUnpriced).toBe(false);
  });
});

describe("withAdHocFees — 이번 건만 수정 (INV-PN5)", () => {
  it("수정한 금액이 반영된 새 내역을 돌려준다", () => {
    const b = buildTuition(SLOTS, PRICES, []);
    const edited = withAdHocFees(b, new Map([["수학", 300_000]]));
    expect(edited.lines[0]?.monthlyFee).toBe(300_000);
    expect(edited.lines[0]?.source).toBe("adHoc");
    expect(edited.total).toBe(420_000);
  });

  it("원본 내역과 저장 모델(가격표·예외)을 건드리지 않는다", () => {
    const prices = Object.freeze([...PRICES]);
    const overrides = Object.freeze<SubjectFeeOverride[]>([{ subject: "수학", monthlyFee: 220_000 }]);
    const b = buildTuition(SLOTS, prices, overrides);

    withAdHocFees(b, new Map([["수학", 999_000]]));

    expect(b.lines[0]?.monthlyFee).toBe(220_000); // 원본 내역 불변
    expect(prices[0]?.monthlyFee).toBe(250_000); // 가격표 불변
    expect(overrides[0]?.monthlyFee).toBe(220_000); // 학생별 예외 불변
  });

  it("미등록 조합도 이 자리에서 채워 확정할 수 있다 (INV-PN6 의 탈출구)", () => {
    const b = buildTuition([...SLOTS, slot("사회", "토")], PRICES, []);
    expect(b.total).toBeNull();
    const filled = withAdHocFees(b, new Map([["사회", 90_000]]));
    expect(filled.hasUnpriced).toBe(false);
    expect(filled.total).toBe(460_000);
  });

  it("잘못된 금액(소수·음수)은 수정으로 받아들이지 않는다 (INV-PN2)", () => {
    const b = buildTuition(SLOTS, PRICES, []);
    const edited = withAdHocFees(b, new Map([["수학", -1]]));
    expect(edited.lines[0]?.monthlyFee).toBe(250_000); // 무시하고 원래 값 유지
  });
});

describe("toNoticeStudent — 이미지에 실릴 학생 정보 (INV-PN3)", () => {
  const input = {
    name: "김서연",
    school: "한빛중학교",
    birthDate: "2011-04-12",
    grade: "중3",
  };

  it("생년월일 대신 출생연도만 싣는다", () => {
    const s = toNoticeStudent(input);
    expect(s.birthYear).toBe(2011);
    expect(JSON.stringify(s)).not.toContain("2011-04-12");
    expect(JSON.stringify(s)).not.toContain("04-12");
  });

  it("이미지 모델은 이름·학년·학교·출생연도만 갖는다 — 평가·연락처·주소가 들어갈 자리가 없다", () => {
    const s = toNoticeStudent(input);
    expect(Object.keys(s).sort()).toEqual(["birthYear", "grade", "name", "school"]);
  });

  it("입력에 개인정보가 더 얹혀 와도 출력에는 새지 않는다", () => {
    const s = toNoticeStudent({ ...input, phone: "010-1234-5678", address: "서울시 강남구" } as typeof input);
    expect(JSON.stringify(s)).not.toContain("010-1234-5678");
    expect(JSON.stringify(s)).not.toContain("강남구");
  });

  it("잘못된 생년월일이면 연도를 비운다 (틀린 해를 찍지 않는다)", () => {
    expect(toNoticeStudent({ ...input, birthDate: "" }).birthYear).toBeNull();
  });
});

describe("noticeBlockers — 생성을 막아야 하는 조건 (INV-PN4)", () => {
  const ok = { studentName: "김서연", targetMonth: "2026.08", total: 370_000 as number | null };

  it("이름과 대상 월이 있고 금액이 확정되면 막지 않는다", () => {
    expect(noticeBlockers(ok)).toEqual([]);
  });

  it("학생 이름이 비면 막는다 — 누구 것인지 모르는 청구서가 나가면 오발송을 알 수 없다", () => {
    expect(noticeBlockers({ ...ok, studentName: "  " })).toContain("학생 이름이 없습니다");
  });

  it("대상 월이 비거나 형식이 어긋나면 막는다", () => {
    expect(noticeBlockers({ ...ok, targetMonth: "" })).toContain("대상 월을 선택해주세요");
    expect(noticeBlockers({ ...ok, targetMonth: "2026-8" })).toContain("대상 월을 선택해주세요");
  });

  it("합계가 미확정이면 막는다 (INV-PN6)", () => {
    expect(noticeBlockers({ ...ok, total: null })).toContain("금액이 비어 있는 과목이 있습니다");
  });

  it("막을 이유가 여럿이면 전부 돌려준다 (하나씩 고치게 하지 않는다)", () => {
    expect(noticeBlockers({ studentName: "", targetMonth: "", total: null })).toHaveLength(3);
  });
});

// 내보내기 화면이 타이핑 받은 금액 문자열을 도메인 값으로 바꾸는 지점.
// 여기가 없던 동안 화면은 `if (raw !== "") edits.set(s, Number(raw))` 로 넘겼고,
// withAdHocFees 가 무효값을 **조용히 버려** 입력칸에 보이는 값과 다른 금액으로 이미지가 나갔다.
// 스펙 S2 는 "검증에서 막히고 이미지가 만들어지지 않는다" 이므로, 버리는 게 아니라 드러내야 한다.
describe("parseFeeEdits — 타이핑한 금액을 막을 것과 받을 것으로 가른다 (INV-PN2)", () => {
  it("빈칸은 수정이 아니다 — 무효도 아니고 편집도 아니다", () => {
    const r = parseFeeEdits({ 수학: "", 논술: "   " });
    expect(r.edits.size).toBe(0);
    expect(r.invalid).toHaveLength(0);
  });

  it("정수 금액은 수정으로 받는다", () => {
    const r = parseFeeEdits({ 수학: "220000", 논술: "0" });
    expect(r.edits.get("수학")).toBe(220000);
    expect(r.edits.get("논술")).toBe(0); // 0 은 면제라는 실제 의미가 있다
    expect(r.invalid).toHaveLength(0);
  });

  it("음수·소수는 버리지 않고 무효로 드러낸다 (INV-PN2 / S2)", () => {
    const r = parseFeeEdits({ 수학: "-10000", 논술: "180000.5" });
    expect(r.invalid).toEqual(expect.arrayContaining(["수학", "논술"]));
    expect(r.edits.size).toBe(0); // 무효값이 옛 금액을 덮어쓰지도, 통과하지도 않는다
  });

  it("상한을 넘거나 숫자가 아니면 무효다", () => {
    const r = parseFeeEdits({ 수학: String(MAX_AMOUNT + 1), 논술: "이십만원" });
    expect(r.invalid).toEqual(expect.arrayContaining(["수학", "논술"]));
  });

  it("무효가 하나라도 있으면 나머지가 멀쩡해도 그 과목만 무효로 남는다", () => {
    const r = parseFeeEdits({ 수학: "220000", 논술: "-1" });
    expect(r.edits.get("수학")).toBe(220000);
    expect(r.invalid).toEqual(["논술"]);
  });
});
