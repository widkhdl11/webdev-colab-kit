import { el } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";
import type { Exam, SubjectScore } from "@/entities/exam-score/model";

// 시험 성적 이력 표. 시험 하나를 과목별 행으로 펼치고, 시험/종류/시기는 rowspan으로 묶는다.
// 표시만 — 점수 요약(평균/최고)은 entities(summarizeScores)에서 계산해 넘겨받는다.
export function renderExamScoreTable(
  exams: Exam[],
  editHrefFor?: (examId: string) => string,
): HTMLElement {
  if (exams.length === 0) {
    return el("p", { class: "empty-note" }, "입력된 시험 성적이 없습니다.");
  }
  const rows: HTMLElement[] = [];
  for (const exam of exams) {
    // 과목이 없는 시험도 한 행으로 표시(점수 칸은 "—"). null = 빈 과목 자리.
    const lines: (SubjectScore | null)[] = exam.scores.length > 0 ? [...exam.scores] : [null];
    lines.forEach((s, i) => {
      const cells: HTMLElement[] = [];
      if (i === 0) {
        const span = String(lines.length);
        const nameNode: Child = editHrefFor
          ? el("a", { class: "cell-link", href: editHrefFor(exam.id) }, exam.examName)
          : exam.examName;
        cells.push(
          el("td", { class: "exam-cell", rowspan: span }, nameNode),
          el("td", { class: "exam-cell", rowspan: span }, el("span", { class: "chip" }, exam.kind)),
          el("td", { class: "exam-cell num", rowspan: span }, exam.period),
        );
      }
      cells.push(
        el("td", {}, s ? s.subject : "—"),
        s
          ? el("td", { class: "col-right num score-cell" },
              el("strong", {}, String(s.score)),
              el("span", { class: "score-cell__max" }, ` / ${s.max}`),
            )
          : el("td", { class: "col-right" }, "—"),
      );
      const isEnd = i === lines.length - 1;
      rows.push(el("tr", isEnd ? { class: "exam-end" } : {}, ...cells));
    });
  }
  return el("table", { class: "table table--grouped" },
    el("caption", { class: "sr-only" }, "시험 성적 이력. 시험·종류·시기별로 과목 점수를 묶어 보여줍니다."),
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
