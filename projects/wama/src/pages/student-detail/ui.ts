import { el } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";
import { getStudent } from "@/entities/student/repo";
import { getSchedule } from "@/entities/schedule/repo";
import { getEvaluations } from "@/entities/evaluation/repo";
import { getExamScores } from "@/entities/exam-score/repo";
import { summarizeScores } from "@/entities/exam-score/model";
import { renderHeader } from "@/widgets/header/ui";
import { renderScheduleTable } from "@/widgets/schedule-table/ui";
import { renderEvaluationHistory } from "@/widgets/evaluation-history/ui";
import { renderExamScoreTable } from "@/widgets/exam-score-table/ui";

function sectionCard(title: string, action: Child, body: Child): HTMLElement {
  return el("section", { class: "section-card" },
    el("div", { class: "section-card__head" },
      el("h2", { class: "section-card__title" }, title),
      action,
    ),
    el("div", { class: "section-card__body" }, body),
  );
}

function metaItem(label: string, value: string): HTMLElement {
  return el("div", { class: "hero-meta__item" },
    el("span", { class: "hero-meta__label" }, label),
    el("span", { class: "hero-meta__value" }, value),
  );
}

function notFound(root: HTMLElement, id: string): void {
  root.replaceChildren(
    renderHeader("온마음수학학원", { name: "김지현 선생님", role: "담임 · 중등부" }),
    el("main", { class: "container page" },
      el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
      el("div", { class: "empty-state" },
        el("h1", { class: "page__title" }, "학생을 찾을 수 없습니다"),
        el("p", { class: "page__desc" }, `요청한 학생(${id})이 존재하지 않거나 접근 권한이 없습니다.`),
      ),
    ),
  );
}

// 학생 상세 페이지 조합 (표시만 — 데이터는 repo에서, 판단 로직 없음).
export async function mountStudentDetailPage(root: HTMLElement, id: string): Promise<void> {
  const student = await getStudent(id);
  if (!student) {
    notFound(root, id);
    return;
  }

  const [slots, evaluations, scores] = await Promise.all([
    getSchedule(id),
    getEvaluations(id),
    getExamScores(id),
  ]);
  const scoreSummary = summarizeScores(scores);

  const heroActions = el("div", { class: "hero-actions" },
    el("a", { class: "btn-ghost", href: `#/students/${student.id}/edit` }, "정보 수정"),
    el("button", { class: "btn-primary", type: "button" },
      el("span", { "aria-hidden": "true" }, "⇩ "), "평가표 내보내기"),
  );

  const scoreStat = (label: string, value: string): HTMLElement =>
    el("div", { class: "score-summary__item" },
      el("span", { class: "score-summary__value num" }, value),
      el("span", { class: "score-summary__label" }, label),
    );

  root.replaceChildren(
    renderHeader("온마음수학학원", { name: "김지현 선생님", role: "담임 · 중등부" }),
    el("main", { class: "container page detail" },
      el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),

      el("section", { class: "student-hero" },
        el("div", { class: "student-hero__id" },
          el("span", { class: "student-hero__avatar", "aria-hidden": "true" }, student.name.slice(0, 1)),
          el("div", {},
            el("h1", { class: "student-hero__name" }, student.name),
            el("div", { class: "hero-meta" },
              metaItem("학년", student.grade),
              metaItem("학교", student.school),
              metaItem("담당 과목", student.subject),
            ),
          ),
        ),
        heroActions,
      ),

      el("div", { class: "detail-grid" },
        sectionCard("시간표", null, renderScheduleTable(slots)),
        sectionCard(
          "시험 성적",
          scores.length > 0
            ? el("div", { class: "score-summary" },
                scoreStat("평균", `${scoreSummary.avgPct}%`),
                scoreStat("최고", `${scoreSummary.bestPct}%`),
                scoreStat("횟수", `${scoreSummary.count}회`),
              )
            : null,
          renderExamScoreTable(scores),
        ),
      ),

      sectionCard("월간 서술 평가 이력", null, renderEvaluationHistory(evaluations)),
    ),
  );
}
