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

export type FeeInputResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string };

// 화면이 타이핑 받은 금액 문자열 → 도메인 값. — INV-PN2
//
// 빈칸을 0 으로 강등하지 않는 것이 핵심이다. `Number("") === 0` 이라 화면이 그대로 넘기면
// 금액칸을 비운 채 저장했을 때 **0원 수강료가 조용히 등록**된다. 그러면 그 (과목, 주 횟수)는
// "가격 없음"이 아니라 "0원 가격"이 되어 내보내기의 빈칸 표시도 생성 차단(INV-PN6)도 안 걸리고,
// 0원 청구서가 경고 없이 나간다. 반대로 **직접 친 0 은 면제**라는 실제 의미가 있어 받아들인다.
export function parseSubjectFeeInput(text: string): FeeInputResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "월정액을 입력하세요." };
  const n = Number(trimmed);
  if (!isIntegerAmount(n, MAX_SUBJECT_FEE)) {
    return { ok: false, error: "금액은 0 이상 정수로 입력해주세요." };
  }
  return { ok: true, value: n };
}

// 한 과목의 가격만 주 횟수 오름차순으로. "이 과목 기본가가 얼마인가"를 보여주는 자리들이 쓴다.
// 고르고 정렬하는 규칙을 화면이 들고 있으면 화면마다 달라진다 — 시간표에서 실제로 어긋났다(2026-08-04).
export function pricesForSubject(prices: readonly SubjectPrice[], subjectId: string): SubjectPrice[] {
  return prices
    .filter((p) => p.subjectId === subjectId)
    .sort((a, b) => a.sessionsPerWeek - b.sessionsPerWeek);
}

// 표시 순서: 과목명 → 주 횟수. 원본은 건드리지 않는다.
export function sortPrices(prices: readonly SubjectPrice[]): SubjectPrice[] {
  return [...prices].sort(
    (a, b) => a.subject.localeCompare(b.subject, "ko") || a.sessionsPerWeek - b.sessionsPerWeek,
  );
}
