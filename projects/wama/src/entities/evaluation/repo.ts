import type { Evaluation } from "./model";

// 임시 목업. 데이터 계층(Supabase) 연결 시 getEvaluations 구현만 교체한다.
// 최신 월이 위로 오도록 정렬된 상태로 둔다 (표시 순서는 상위에서 다시 강제하지 않는다).
const DEFAULT_EVALUATIONS: readonly Evaluation[] = [
  {
    id: "ev1", month: "2026.07", subject: "수학(공통)", teacher: "김지현",
    body: "함수 단원 개념 이해도가 눈에 띄게 올라왔습니다. 응용 문제에서 조건 해석을 놓치는 경우가 줄었고, 오답 노트를 꾸준히 작성해 스스로 약점을 관리하고 있습니다. 다음 달은 서술형 풀이 과정의 논리 전개를 다듬는 데 집중하겠습니다.",
  },
  {
    id: "ev2", month: "2026.06", subject: "수학(공통)", teacher: "김지현",
    body: "수업 태도가 성실하고 질문의 질이 좋아졌습니다. 계산 실수를 줄이기 위한 검산 습관을 들이는 중이며, 기본기는 안정적입니다.",
  },
  {
    id: "ev3", month: "2026.05", subject: "심화 문제풀이", teacher: "박선우",
    body: "심화반 진입 초기라 낯선 유형에 시간이 걸리지만 포기하지 않고 끝까지 시도하는 점이 강점입니다. 풀이 시간을 관리하는 연습을 병행하겠습니다.",
  },
];

export function getEvaluations(studentId: string): Promise<Evaluation[]> {
  void studentId;
  return Promise.resolve([...DEFAULT_EVALUATIONS]);
}
