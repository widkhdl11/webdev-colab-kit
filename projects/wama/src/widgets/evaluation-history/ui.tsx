import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { groupByMonth, type Evaluation } from "@/entities/evaluation/model";

// 월간 서술 평가 이력. 과목별로 기록되므로 같은 달에 여러 개 → 년.월로 묶는다.
// 표시만 — 묶는 규칙은 entities(groupByMonth), 정렬은 repo 가 보장한 순서(최신월 우선).
// 학원 내부 공유용이다 — 학부모에게 나가는 이미지에는 평가가 들어가지 않는다(INV-PN3).
export function EvaluationHistory({
  evaluations,
  editPathFor,
}: {
  readonly evaluations: Evaluation[];
  /** 라우터 경로를 돌려준다(해시 없이 "/students/..."). 없으면 수정 링크를 숨긴다. */
  readonly editPathFor?: (evalId: string) => string;
}): ReactNode {
  if (evaluations.length === 0) {
    return <p className="empty-note">작성된 월간 평가가 없습니다.</p>;
  }

  // 묶는 규칙은 entities(groupByMonth)가 정한다 — 화면마다 따로 묶으면 같은 데이터가 다르게 보인다.
  return (
    <div className="eval-groups">
      {groupByMonth(evaluations).map((g) => (
        <section className="eval-group" key={g.month}>
          <div className="eval-group__head">
            <h3 className="eval-group__month num">{g.month}</h3>
            <span className="eval-group__count">{`${g.items.length}개 과목`}</span>
          </div>
          <ul className="eval-list">
            {g.items.map((e) => (
              <li className="eval-item" key={e.id}>
                <div className="eval-item__head">
                  <span className="eval-item__subject">{e.subject}</span>
                  <span className="eval-item__teacher">{`${e.teacher} 선생님`}</span>
                  {editPathFor && (
                    <Link className="cell-link eval-item__edit" to={editPathFor(e.id)}>수정</Link>
                  )}
                </div>
                <p className="eval-item__body">{e.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
