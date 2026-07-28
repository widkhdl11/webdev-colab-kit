import { el } from "@/shared/lib/dom";
import type { Evaluation } from "@/entities/evaluation/model";

// 월간 서술 평가 이력. 과목별로 기록되므로 같은 달에 여러 개 → 년.월로 묶는다.
// (한 달 = 학부모 전달용 평가표 한 장의 단위.) 표시만 — 정렬은 repo가 보장한 순서(최신월 우선).
export function renderEvaluationHistory(
  evaluations: Evaluation[],
  editHrefFor?: (evalId: string) => string,
): HTMLElement {
  if (evaluations.length === 0) {
    return el("p", { class: "empty-note" }, "작성된 월간 평가가 없습니다.");
  }

  // 월 그룹으로 묶되 등장 순서(최신월 우선)를 유지한다.
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
