// 과목 가격표 한 줄 — (과목 × 주 횟수) → 월정액.
// docs/specs/payment-notice-export.md (approved, 봉인 INV-PN1~PN7) 의 "금액이 정해지는 방식".
// 계산·합산은 entities/tuition 이 맡고, 여기는 **저장되는 한 줄**의 파싱·검증·정렬만 맡는다.
// 순수 도메인 — DB/네트워크를 모른다.
import { isIntegerAmount } from "@/shared/lib/money";

// 상한의 출처는 스펙의 "입력과 검증" 표다(코드가 아니라 문서가 단일 진실).
export const MAX_SUBJECT_FEE = 10_000_000;
// 주 7일을 넘는 수업은 시간표로 표현할 수 없다.
export const MAX_SESSIONS_PER_WEEK = 7;

export interface SubjectPrice {
  readonly id: string;
  readonly subjectId: string;
  readonly subject: string; // 과목명 — tuition 이 이 이름으로 시간표와 맞춘다
  readonly sessionsPerWeek: number;
  readonly monthlyFee: number;
}

// 응답은 subject 를 조인해 { subject: { name } } 로 중첩돼 온다. 경계에서 한 번 펴서 도메인 값으로.
export function parseSubjectPrice(raw: unknown): SubjectPrice {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("과목 가격 응답이 객체가 아닙니다");
  }
  const r = raw as Record<string, unknown>;
  const joined = r.subject;
  const name =
    typeof joined === "object" && joined !== null ? (joined as Record<string, unknown>).name : undefined;

  if (typeof r.id !== "string" || typeof r.subject_id !== "string" || typeof name !== "string") {
    throw new Error("과목 가격 응답에 id/subject_id/과목명이 없거나 형식이 잘못됐습니다");
  }
  if (typeof r.sessions_per_week !== "number" || typeof r.monthly_fee !== "number") {
    throw new Error("과목 가격 응답의 주 횟수·금액이 수가 아닙니다");
  }
  return {
    id: r.id,
    subjectId: r.subject_id,
    subject: name,
    sessionsPerWeek: r.sessions_per_week,
    monthlyFee: r.monthly_fee,
  };
}

export type SubjectPriceInput = Pick<SubjectPrice, "sessionsPerWeek" | "monthlyFee">;
export type SubjectPriceErrors = Partial<Record<keyof SubjectPriceInput, string>>;

// 틀린 칸을 전부 모아 돌려준다(하나씩 고치게 하지 않는다).
export function validateSubjectPrice(input: SubjectPriceInput): SubjectPriceErrors {
  const errors: SubjectPriceErrors = {};
  const { sessionsPerWeek, monthlyFee } = input;

  if (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > MAX_SESSIONS_PER_WEEK) {
    errors.sessionsPerWeek = `주 횟수는 1~${MAX_SESSIONS_PER_WEEK}회로 입력해주세요`;
  }
  if (!isIntegerAmount(monthlyFee, MAX_SUBJECT_FEE)) {
    errors.monthlyFee = "금액은 0 이상 정수로 입력해주세요";
  }
  return errors;
}

// 표시 순서: 과목명 → 주 횟수. 원본은 건드리지 않는다.
export function sortPrices(prices: readonly SubjectPrice[]): SubjectPrice[] {
  return [...prices].sort(
    (a, b) => a.subject.localeCompare(b.subject, "ko") || a.sessionsPerWeek - b.sessionsPerWeek,
  );
}
