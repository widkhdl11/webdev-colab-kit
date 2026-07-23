import { el } from "@/shared/lib/dom";
import type { ExamScore } from "@/entities/exam-score/model";

// 시험 성적 이력 표. 표시만 — 점수 요약(평균/최고)은 entities(summarizeScores)에서 계산해 넘겨받는다.
export function renderExamScoreTable(scores: ExamScore[]): HTMLElement {
  if (scores.length === 0) {
    return el("p", { class: "empty-note" }, "입력된 시험 성적이 없습니다.");
  }
  const rows = scores.map((s) =>
    el("tr", {},
      el("td", {}, s.examName),
      el("td", {}, el("span", { class: "chip" }, s.kind)),
      el("td", { class: "num" }, s.date),
      el("td", {}, s.subject),
      el("td", { class: "col-right num score-cell" },
        el("strong", {}, String(s.score)),
        el("span", { class: "score-cell__max" }, ` / ${s.max}`),
      ),
    ),
  );
  return el("table", { class: "table" },
    el("caption", { class: "sr-only" }, "시험 성적 이력. 시험, 종류, 시기, 과목, 점수."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "시험"),
        el("th", { scope: "col" }, "종류"),
        el("th", { scope: "col" }, "시기"),
        el("th", { scope: "col" }, "과목"),
        el("th", { scope: "col", class: "col-right" }, "점수"),
      ),
    ),
    el("tbody", {}, ...rows),
  );
}
