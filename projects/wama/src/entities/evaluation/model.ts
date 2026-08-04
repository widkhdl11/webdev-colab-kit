// 월간 서술 평가 표시용 읽기 모델. **학원 안에서 선생님끼리 공유하는 용도**이며
// 학부모에게 나가는 이미지에는 들어가지 않는다(PRODUCT 필수기능 교체 2026-08-03, INV-PN3).
// 작성 선생님을 기록한다 — 여러 과목 선생님이 같은 학생을 평가할 수 있다.
export interface Evaluation {
  readonly id: string;
  readonly month: string; // "2026.07"
  readonly subject: string;
  readonly teacher: string;
  readonly body: string; // 서술 평가 본문
}

export interface EvaluationMonth {
  readonly month: string;
  readonly items: readonly Evaluation[];
}

// 과목별로 기록되므로 한 달에 여러 개가 생긴다 → 년.월로 묶는다(한 달 = 한 묶음의 단위, DECISIONS 2026-07-24).
// 순서는 입력 순서를 그대로 지킨다 — repo 가 최신월 우선으로 정렬해 주므로 여기서 다시 정렬하면
// 그 보장을 덮어쓴다. 떨어져 있던 같은 달은 처음 나온 자리에 합친다.
//
// 묶는 규칙을 화면이 아니라 여기 두는 이유: 화면마다 따로 구현하면 같은 데이터가 다르게 보인다.
// 시간표에서 실제로 그렇게 어긋났다(편집 1줄 / 상세 2줄, 사용자 보고 2026-08-04).
export function groupByMonth(evaluations: readonly Evaluation[]): EvaluationMonth[] {
  const groups: { month: string; items: Evaluation[] }[] = [];
  const index = new Map<string, Evaluation[]>();
  for (const e of evaluations) {
    let bucket = index.get(e.month);
    if (!bucket) {
      bucket = [];
      index.set(e.month, bucket);
      groups.push({ month: e.month, items: bucket });
    }
    bucket.push(e);
  }
  return groups;
}
