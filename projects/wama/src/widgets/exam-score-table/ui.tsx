import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Exam, SubjectScore } from "@/entities/exam-score/model";

// 시험 성적 이력 표. 시험 하나를 과목별 행으로 펼치고, 시험/종류/시기는 rowSpan으로 묶는다.
// 표시만 — 점수 요약(평균/최고)은 entities(summarizeScores)에서 계산해 넘겨받는다.
export function ExamScoreTable({
  exams,
  editPathFor,
}: {
  readonly exams: Exam[];
  /** 라우터 경로를 돌려준다(해시 없이 "/students/..."). 없으면 시험명을 링크로 만들지 않는다. */
  readonly editPathFor?: (examId: string) => string;
}): ReactNode {
  if (exams.length === 0) {
    return <p className="empty-note">입력된 시험 성적이 없습니다.</p>;
  }

  const rows: ReactNode[] = [];
  for (const exam of exams) {
    // 과목이 없는 시험도 한 행으로 표시(점수 칸은 "—"). null = 빈 과목 자리.
    const lines: (SubjectScore | null)[] = exam.scores.length > 0 ? [...exam.scores] : [null];
    lines.forEach((s, i) => {
      const isEnd = i === lines.length - 1;
      rows.push(
        <tr className={isEnd ? "exam-end" : undefined} key={`${exam.id}-${i}`}>
          {i === 0 && (
            <>
              <td className="exam-cell" rowSpan={lines.length}>
                {editPathFor
                  ? <Link className="cell-link" to={editPathFor(exam.id)}>{exam.examName}</Link>
                  : exam.examName}
              </td>
              <td className="exam-cell" rowSpan={lines.length}><span className="chip">{exam.kind}</span></td>
              <td className="exam-cell num" rowSpan={lines.length}>{exam.period}</td>
            </>
          )}
          <td>{s ? s.subject : "—"}</td>
          {s
            ? (
              <td className="col-right num score-cell">
                <strong>{s.score}</strong>
                <span className="score-cell__max">{` / ${s.max}`}</span>
              </td>
            )
            : <td className="col-right">—</td>}
        </tr>,
      );
    });
  }

  return (
    <table className="table table--grouped">
      <caption className="sr-only">시험 성적 이력. 시험·종류·시기별로 과목 점수를 묶어 보여줍니다.</caption>
      <thead>
        <tr>
          <th scope="col">시험</th>
          <th scope="col">종류</th>
          <th scope="col">시기</th>
          <th scope="col">과목</th>
          <th scope="col" className="col-right">점수</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
