// 월간 서술 평가 표시용 읽기 모델 (학부모 전달용, 이미지/PDF 대상).
// 작성 선생님을 기록한다 — 여러 과목 선생님이 같은 학생을 평가할 수 있다.
export interface Evaluation {
  readonly id: string;
  readonly month: string; // "2026.07"
  readonly subject: string;
  readonly teacher: string;
  readonly body: string; // 서술 평가 본문
}
