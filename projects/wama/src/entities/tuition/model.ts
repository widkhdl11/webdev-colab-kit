// 수강료 계산 도메인. docs/specs/payment-notice-export.md (approved 2026-08-03) 의 규칙을 담는다.
// 순수 계산만 — 네트워크·DOM 을 모른다. 저장은 repo 몫, 표시는 상위 레이어 몫.
//
// 청구액 = Σ(학생별 예외 ?? 가격표[과목, 주 횟수]). 주 횟수는 시간표에서 파생(저장하지 않는다).
// 한 달은 주 수와 무관한 월정액이다 — 달력으로 회차를 세지 않는다.
//
// 자족 슬라이스: schedule·student 를 import 하지 않고 **필요한 모양만** 아래에 선언한다(FSD 동일 레이어 금지).
// 실제 ScheduleSlot·StudentProfile 은 이 모양을 만족하므로 상위(features)에서 그대로 넘기면 된다.

// 주 횟수를 세는 데 필요한 최소 모양 — 요일·시간은 금액과 무관하다.
export interface TuitionSlot {
  readonly subject: string;
}

// 금액 단위는 원(KRW) 정수 고정. 통화는 하나뿐이라 값 객체로 감싸지 않고 규칙만 강제한다. — INV-PN2
export const MAX_AMOUNT = 10_000_000;

export function isValidAmount(v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v <= MAX_AMOUNT;
}

// 학원 단위 가격표: (과목, 주 횟수) → 월정액.
export interface SubjectPrice {
  readonly subject: string;
  readonly sessionsPerWeek: number;
  readonly monthlyFee: number;
}

// 학생별 과목 예외 — 형제 감면·개별 할인은 여기로 표현한다(총액 고정이 아니라 과목 단위).
export interface SubjectFeeOverride {
  readonly subject: string;
  readonly monthlyFee: number;
}

// unpriced = 가격표에 그 조합이 없다. 0 이 아니라 "모른다"이며, 합계를 막는다. — INV-PN6
// adHoc = 내보내기 화면에서 이번 건만 고친 값. 저장되지 않는다. — INV-PN5
export type FeeSource = "override" | "priceTable" | "unpriced" | "adHoc";

export interface TuitionLine {
  readonly subject: string;
  readonly sessionsPerWeek: number;
  readonly monthlyFee: number | null;
  readonly source: FeeSource;
}

export interface TuitionBreakdown {
  readonly lines: readonly TuitionLine[];
  readonly hasUnpriced: boolean;
  readonly total: number | null; // 미확정 줄이 있으면 null — 조용한 과소청구 방지
}

// 주 횟수 = 그 과목의 주간 슬롯 개수. 조회 시점 계산이라 시간표를 고치면 즉시 따라온다. — INV-PN7
export function sessionsPerWeekBySubject(
  slots: readonly TuitionSlot[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const s of slots) counts.set(s.subject, (counts.get(s.subject) ?? 0) + 1);
  return counts;
}

function summarize(lines: readonly TuitionLine[]): TuitionBreakdown {
  const hasUnpriced = lines.some((l) => l.monthlyFee === null);
  const total = hasUnpriced ? null : lines.reduce((sum, l) => sum + (l.monthlyFee ?? 0), 0);
  return { lines, hasUnpriced, total };
}

export function buildTuition(
  slots: readonly TuitionSlot[],
  prices: readonly SubjectPrice[],
  overrides: readonly SubjectFeeOverride[],
): TuitionBreakdown {
  const lines: TuitionLine[] = [];
  for (const [subject, sessionsPerWeek] of sessionsPerWeekBySubject(slots)) {
    const override = overrides.find((o) => o.subject === subject);
    if (override && isValidAmount(override.monthlyFee)) {
      lines.push({ subject, sessionsPerWeek, monthlyFee: override.monthlyFee, source: "override" });
      continue;
    }
    // 가격표는 (과목, 주 횟수) 정확히 일치만 인정한다. 가까운 횟수로 근사하면 조용히 틀린 금액이 된다.
    const priced = prices.find((p) => p.subject === subject && p.sessionsPerWeek === sessionsPerWeek);
    lines.push(
      priced && isValidAmount(priced.monthlyFee)
        ? { subject, sessionsPerWeek, monthlyFee: priced.monthlyFee, source: "priceTable" }
        : { subject, sessionsPerWeek, monthlyFee: null, source: "unpriced" },
    );
  }
  return summarize(lines);
}

// 내보내기 화면의 이번 건 수정. 새 내역을 만들 뿐 입력(내역·가격표·예외)을 건드리지 않는다. — INV-PN5
export function withAdHocFees(
  breakdown: TuitionBreakdown,
  edits: ReadonlyMap<string, number>,
): TuitionBreakdown {
  return summarize(
    breakdown.lines.map((line) => {
      const edited = edits.get(line.subject);
      return edited !== undefined && isValidAmount(edited)
        ? { ...line, monthlyFee: edited, source: "adHoc" as const }
        : line;
    }),
  );
}

// 이미지에 실릴 학생 정보. 이 타입에 담기지 않은 값은 이미지에 나갈 수 없다 — 개인정보 차단은
// 렌더 단계의 주의가 아니라 모델의 모양으로 강제한다. 생년은 연도만. — INV-PN3
export interface NoticeStudent {
  readonly name: string;
  readonly grade: string;
  readonly school: string;
  readonly birthYear: number | null;
}

// 학년은 student 슬라이스가 파생해 넘긴다(자족 슬라이스 유지 — 학년 규칙은 저기 것이다).
export interface NoticeStudentInput {
  readonly name: string;
  readonly school: string;
  readonly birthDate: string;
  readonly grade: string;
}

export function toNoticeStudent(input: NoticeStudentInput): NoticeStudent {
  const year = Number(input.birthDate.slice(0, 4));
  return {
    name: input.name,
    grade: input.grade,
    school: input.school,
    birthYear: Number.isInteger(year) && year > 1900 ? year : null,
  };
}

const MONTH_RE = /^\d{4}\.(0[1-9]|1[0-2])$/;

// 생성을 막아야 하는 이유를 전부 모아 돌려준다(하나씩 고치게 하지 않는다). — INV-PN4 · INV-PN6
export function noticeBlockers(input: {
  studentName: string;
  targetMonth: string;
  total: number | null;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.studentName.trim() === "") blockers.push("학생 이름이 없습니다");
  if (!MONTH_RE.test(input.targetMonth)) blockers.push("대상 월을 선택해주세요");
  if (input.total === null) blockers.push("금액이 비어 있는 과목이 있습니다");
  return blockers;
}
