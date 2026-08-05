// 시험별 점수 이력 표시용 읽기 모델 (통계 페이지의 원천이자 상세의 성적 카드).
// 시험종류: 중간·기말·학원시험·모의고사 등.
export type ExamKind = "중간" | "기말" | "학원" | "모의";
export const EXAM_KINDS: readonly ExamKind[] = ["중간", "기말", "학원", "모의"];

// 한 과목의 취득 점수 한 줄.
// ── 시험 식별 문자열 ─────────────────────────────────────────────────────────
// period·examName 의 형식은 이 슬라이스가 정한다. 전에는 화면(pages/score-form)이 조립하고
// entities/stats 가 파싱했다 — 같은 진실이 두 벌이라, 화면 쪽 형식만 바꾸면 통계에서 시험이
// 조용히 사라졌다(정기시험으로 인식 안 됨).
//
// stats 는 자족 슬라이스라 이걸 import 할 수 없다(FSD 동일 레이어 금지). 그래서 계약은
// 양쪽 테스트에 같은 문자열 리터럴을 박아 고정한다 — 한쪽만 바꾸면 반대쪽 테스트가 깨진다.

// 정기고사(중간·기말)는 연도+학기로, 비정기(학원·모의)는 이름+날짜로 식별한다.
export function isIrregularKind(kind: string): boolean {
  return kind === "학원" || kind === "모의";
}

/** "2026" + "1학기" → "2026 1학기" (stats.parsePeriod 가 읽는 형식) */
export function formatRegularPeriod(year: string, semester: string): string {
  return `${year} ${semester}`;
}

/** "1학기" + "중간" → "1학기 중간고사" */
export function formatRegularExamName(semester: string, kind: string): string {
  return `${semester} ${kind}고사`;
}

/** "2026 1학기" → 폼 값으로 되돌린다(수정 화면 프리필). 형식이 아니면 null. */
export function parseRegularPeriod(period: string): { year: string; semester: string } | null {
  const m = /^(\d{4})\s+([12]학기)$/.exec(period.trim());
  return m ? { year: m[1] as string, semester: m[2] as string } : null;
}

/** date 입력값 "2026-08-05" → 저장 형식 "2026.08.05" */
export function formatIrregularPeriod(isoDate: string): string {
  return isoDate.replaceAll("-", ".");
}

/** 저장 형식 "2026.08.05" → date 입력값 "2026-08-05" */
export function parseIrregularPeriod(period: string): string {
  return period.replaceAll(".", "-");
}

export interface SubjectScore {
  readonly subject: string;
  readonly score: number; // 취득 점수
  readonly max: number; // 만점
}

// 한 시험은 여러 과목 점수를 가진다 (정기시험은 다과목, 학원시험은 1개일 수도 여러 개일 수도).
// 정기(중간·기말)는 연도+학기로, 비정기(학원·모의)는 이름+날짜로 식별 → period가 시기 표시값.
export interface Exam {
  readonly id: string;
  readonly examName: string; // "1학기 중간고사" · "7월 학원 모의고사"
  readonly kind: ExamKind;
  readonly period: string; // 시기 표시: "2026 1학기" 또는 "2026.07.12"
  readonly scores: readonly SubjectScore[];
}

export interface ScoreSummary {
  readonly count: number; // 시험 수 (과목 쌍 수가 아니라 시험 단위)
  readonly avgPct: number; // 시험 평균들의 평균 (만점 대비 %)
  readonly bestPct: number; // 시험 평균 중 최고 (만점 대비 %)
}

// 한 시험의 과목 평균 백분율. 도메인 파생값은 표시 레이어가 아니라 여기(entities)에서 계산한다.
// max<=0 과목은 백분율이 정의되지 않으므로 분모에서 제외한다(NaN/Infinity 방어).
export function examAvgPct(exam: Exam): number {
  const valid = exam.scores.filter((s) => s.max > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, s) => acc + (s.score / s.max) * 100, 0);
  return Math.round(sum / valid.length);
}

// 시험 단위 요약: 각 시험의 과목 평균을 낸 뒤, 시험들끼리 평균/최고를 낸다.
// 횟수(count)는 전체 시험 수 — 표 하단 네비(renderTableNav)의 "전체 N개"와 같은 기준.
// 평균/최고는 백분율이 정의되는(max>0 과목이 있는) 시험만으로 계산한다.
export function summarizeScores(exams: readonly Exam[]): ScoreSummary {
  const scored = exams.filter((e) => e.scores.some((s) => s.max > 0));
  if (scored.length === 0) return { count: exams.length, avgPct: 0, bestPct: 0 };
  const pcts = scored.map(examAvgPct);
  const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / scored.length);
  const bestPct = Math.max(...pcts);
  return { count: exams.length, avgPct, bestPct };
}
