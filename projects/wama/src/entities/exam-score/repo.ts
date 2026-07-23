import type { ExamScore } from "./model";

// 임시 목업. 데이터 계층(Supabase) 연결 시 getExamScores 구현만 교체한다.
// 최근 시험이 위로 오도록 정렬된 상태로 둔다.
const DEFAULT_SCORES: readonly ExamScore[] = [
  { id: "ex1", examName: "7월 학원 모의고사", kind: "모의", date: "2026.07.12", subject: "수학(공통)", score: 88, max: 100 },
  { id: "ex2", examName: "1학기 기말고사", kind: "기말", date: "2026.07.04", subject: "수학(공통)", score: 92, max: 100 },
  { id: "ex3", examName: "6월 학원 레벨테스트", kind: "학원", date: "2026.06.15", subject: "수학(공통)", score: 84, max: 100 },
  { id: "ex4", examName: "1학기 중간고사", kind: "중간", date: "2026.05.02", subject: "수학(공통)", score: 79, max: 100 },
];

export function getExamScores(studentId: string): Promise<ExamScore[]> {
  void studentId;
  return Promise.resolve([...DEFAULT_SCORES]);
}
