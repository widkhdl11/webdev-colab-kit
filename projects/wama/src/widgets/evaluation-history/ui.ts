import { el } from "@/shared/lib/dom";
import type { Evaluation } from "@/entities/evaluation/model";

// 월간 서술 평가 이력. 표시만 — 최신순 정렬은 repo가 이미 보장한 순서를 따른다.
export function renderEvaluationHistory(evaluations: Evaluation[]): HTMLElement {
  if (evaluations.length === 0) {
    return el("p", { class: "empty-note" }, "작성된 월간 평가가 없습니다.");
  }
  const items = evaluations.map((e) =>
    el("li", { class: "eval-item" },
      el("div", { class: "eval-item__head" },
        el("span", { class: "eval-item__month num" }, e.month),
        el("span", { class: "eval-item__subject" }, e.subject),
        el("span", { class: "eval-item__teacher" }, `${e.teacher} 선생님`),
      ),
      el("p", { class: "eval-item__body" }, e.body),
    ),
  );
  return el("ul", { class: "eval-list" }, ...items);
}
