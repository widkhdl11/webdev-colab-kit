// 시험별 점수 이력 표시용 읽기 모델 (통계 페이지의 원천이자 상세의 성적 카드).
// 시험종류: 중간·기말·학원시험·모의고사 등.
export type ExamKind = "중간" | "기말" | "학원" | "모의";

export interface ExamScore {
  readonly id: string;
  readonly examName: string; // "7월 학원 모의고사"
  readonly kind: ExamKind;
  readonly date: string; // "2026.07.12"
  readonly subject: string;
  readonly score: number; // 취득 점수
  readonly max: number; // 만점
}

export interface ScoreSummary {
  readonly count: number;
  readonly avgPct: number; // 만점 대비 평균 백분율
  readonly bestPct: number; // 만점 대비 최고 백분율
}

// 도메인 파생값은 표시 레이어가 아니라 여기(entities)에서 계산한다.
export function summarizeScores(scores: readonly ExamScore[]): ScoreSummary {
  const count = scores.length;
  if (count === 0) return { count: 0, avgPct: 0, bestPct: 0 };
  const pcts = scores.map((s) => Math.round((s.score / s.max) * 100));
  const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / count);
  const bestPct = Math.max(...pcts);
  return { count, avgPct, bestPct };
}
