import { el } from "@/shared/lib/dom";
import { groupByMonth, type Evaluation } from "@/entities/evaluation/model";

// 월간 서술 평가 이력. 과목별로 기록되므로 같은 달에 여러 개 → 년.월로 묶는다.
// 표시만 — 묶는 규칙은 entities(groupByMonth), 정렬은 repo 가 보장한 순서(최신월 우선).
// 학원 내부 공유용이다 — 학부모에게 나가는 이미지에는 평가가 들어가지 않는다(INV-PN3).
export function renderEvaluationHistory(
  evaluations: Evaluation[],
  editHrefFor?: (evalId: string) => string,
): HTMLElement {
  if (evaluations.length === 0) {
    return el("p", { class: "empty-note" }, "작성된 월간 평가가 없습니다.");
  }

  // 묶는 규칙은 entities(groupByMonth)가 정한다 — 화면마다 따로 묶으면 같은 데이터가 다르게 보인다.
  const groups = groupByMonth(evaluations);

  return el("div", { class: "eval-groups" },
    ...groups.map((g) =>
      el("section", { class: "eval-group" },
        el("div", { class: "eval-group__head" },
          el("h3", { class: "eval-group__month num" }, g.month),
          el("span", { class: "eval-group__count" }, `${g.items.length}개 과목`),
        ),
        el("ul", { class: "eval-list" },
          ...g.items.map((e) =>
            el("li", { class: "eval-item" },
              el("div", { class: "eval-item__head" },
                el("span", { class: "eval-item__subject" }, e.subject),
                el("span", { class: "eval-item__teacher" }, `${e.teacher} 선생님`),
                editHrefFor ? el("a", { class: "cell-link eval-item__edit", href: editHrefFor(e.id) }, "수정") : null,
              ),
              el("p", { class: "eval-item__body" }, e.body),
            ),
          ),
        ),
      ),
    ),
  );
}
