// 학생별 과목 금액 예외 — 형제 감면·개별 할인을 표현하는 자리.
// docs/specs/payment-notice-export.md (approved): 한 과목의 금액 = 학생별 예외가 있으면 그것, 없으면 가격표 값.
// 예외를 **과목 단위**로 두는 이유: 총액을 고정하면 과목을 늘리거나 끊어도 금액이 안 따라가 조용히 틀린다.
// 순수 도메인 — DB/네트워크를 모른다.
import { isIntegerAmount } from "@/shared/lib/money";

// 상한의 출처는 스펙의 "입력과 검증" 표다(코드가 아니라 문서가 단일 진실).
export const MAX_STUDENT_FEE = 10_000_000;

export interface StudentSubjectFee {
  readonly id: string;
  readonly subjectId: string;
  readonly subject: string; // 과목명 — tuition 이 이 이름으로 시간표와 맞춘다
  readonly monthlyFee: number;
}

export function parseSubjectFee(raw: unknown): StudentSubjectFee {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("학생 과목 금액 응답이 객체가 아닙니다");
  }
  const r = raw as Record<string, unknown>;
  const joined = r.subject;
  const name =
    typeof joined === "object" && joined !== null ? (joined as Record<string, unknown>).name : undefined;

  if (typeof r.id !== "string" || typeof r.subject_id !== "string" || typeof name !== "string") {
    throw new Error("학생 과목 금액 응답에 id/subject_id/과목명이 없거나 형식이 잘못됐습니다");
  }
  if (typeof r.monthly_fee !== "number") {
    throw new Error("학생 과목 금액 응답의 금액이 수가 아닙니다");
  }
  return { id: r.id, subjectId: r.subject_id, subject: name, monthlyFee: r.monthly_fee };
}

// 통과하면 undefined, 틀리면 사유 문자열.
export function validateSubjectFee(monthlyFee: number): string | undefined {
  return isIntegerAmount(monthlyFee, MAX_STUDENT_FEE) ? undefined : "금액은 0 이상 정수로 입력해주세요";
}

// tuition 은 과목 id 를 모르고 이름으로만 맞춘다(자족 슬라이스). 계산에 넘기기 전 이 모양으로 줄인다.
export function toOverrideList(
  fees: readonly StudentSubjectFee[],
): { subject: string; monthlyFee: number }[] {
  return fees.map((f) => ({ subject: f.subject, monthlyFee: f.monthlyFee }));
}

export interface OverrideDiff {
  readonly added: { subjectId: string; monthlyFee: number }[];
  readonly updated: { id: string; monthlyFee: number }[];
  readonly removed: StudentSubjectFee[];
}

// 폼 저장 시 무엇을 넣고 빼고 고칠지 계산한다. 전부 지우고 다시 넣는 방식은
// 중간에 실패하면 예외가 통째로 사라져 청구액이 조용히 올라간다 — 그래서 차이만 반영한다.
// 빈칸(= Map 에 없음) 은 "예외 없음"이고, 0 은 "0원 청구"다. 둘은 다르다.
export function diffOverrides(
  saved: readonly StudentSubjectFee[],
  entered: ReadonlyMap<string, number>,
): OverrideDiff {
  const added: OverrideDiff["added"] = [];
  const updated: OverrideDiff["updated"] = [];
  const removed: StudentSubjectFee[] = [];

  for (const f of saved) {
    const next = entered.get(f.subjectId);
    if (next === undefined) removed.push(f);
    else if (next !== f.monthlyFee) updated.push({ id: f.id, monthlyFee: next });
  }
  for (const [subjectId, monthlyFee] of entered) {
    if (!saved.some((f) => f.subjectId === subjectId)) added.push({ subjectId, monthlyFee });
  }
  return { added, updated, removed };
}
