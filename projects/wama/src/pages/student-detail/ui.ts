import { el } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";
import { withPending } from "@/shared/lib/form";
import { getStudent, deleteStudent } from "@/entities/student/repo";
import { getSchedule } from "@/entities/schedule/repo";
import { getEvaluations } from "@/entities/evaluation/repo";
import { getExams } from "@/entities/exam-score/repo";
import { summarizeScores } from "@/entities/exam-score/model";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader, type SessionHeader } from "@/features/auth/api";
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

// 표 하단 페이지네이션 (목록 화면의 .pagination 언어 재사용). 표시만.
function renderTableNav(total: number): HTMLElement {
  return el("div", { class: "pagination" },
    el("span", { class: "num" }, `전체 ${total}개 중 1–${total}`),
    el("nav", { class: "pagination__pages", "aria-label": "페이지 이동" },
      el("button", { class: "page-btn", type: "button", "aria-label": "이전 페이지" }, "이전"),
      el("button", { class: "page-btn page-btn--active num", type: "button", "aria-current": "page" }, "1"),
      el("button", { class: "page-btn", type: "button", "aria-label": "다음 페이지" }, "다음"),
    ),
  );
}

// 표를 가로 스크롤 컨테이너로 감싸고(줄바꿈 대신) 하단 네비를 붙인다.
function tableWithNav(table: HTMLElement, total: number): HTMLElement {
  return el("div", {},
    el("div", { class: "table-scroll" }, table),
    renderTableNav(total),
  );
}

function notFound(root: HTMLElement, id: string, hdr: SessionHeader): void {
  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page" },
      el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
      el("div", { class: "empty-state" },
        el("h1", { class: "page__title" }, "학생을 찾을 수 없습니다"),
        el("p", { class: "page__desc" }, `요청한 학생(${id})이 존재하지 않거나 접근 권한이 없습니다.`),
      ),
    ),
  );
}

// 학생 삭제 — 되돌릴 수 없으므로 두 번 눌러 확정(네이티브 dialog 없이). 시간표·평가·성적은 FK ON DELETE CASCADE 로 함께 삭제.
function deleteButton(studentId: string, studentName: string): HTMLElement {
  const btn = el("button", { class: "btn-ghost", type: "button" }) as HTMLButtonElement;
  const idle = "학생 삭제";
  const armed = `"${studentName}" 삭제 — 한 번 더`;
  btn.textContent = idle;
  btn.setAttribute("aria-label", `${studentName} 학생 삭제. 한 번 더 누르면 확정됩니다.`);
  let isArmed = false;
  const disarm = (): void => { isArmed = false; btn.textContent = idle; btn.classList.remove("is-armed"); };
  btn.addEventListener("click", () => {
    if (!isArmed) {
      isArmed = true;
      btn.textContent = armed;
      btn.classList.add("is-armed");
      window.setTimeout(disarm, 4000); // 4초 내 재클릭 없으면 자동 취소
      return;
    }
    void withPending(btn, async () => {
      const res = await deleteStudent(studentId);
      if (!res.ok) { btn.textContent = "삭제 실패 — 다시 시도"; isArmed = false; return; }
      location.hash = "#/students";
    });
  });
  return btn;
}

// 학생 상세 페이지 조합 (표시만 — 데이터는 repo에서, 판단 로직 없음).
export async function mountStudentDetailPage(root: HTMLElement, id: string): Promise<void> {
  const student = await getStudent(id);
  const hdr = await getSessionHeader();
  if (!student) {
    notFound(root, id, hdr);
    return;
  }

  const [slots, evaluations, exams] = await Promise.all([
    getSchedule(id),
    getEvaluations(id),
    getExams(id),
  ]);
  const scoreSummary = summarizeScores(exams);

  const heroActions = el("div", { class: "hero-actions" },
    el("a", { class: "btn-ghost", href: `#/students/${student.id}/edit` }, "정보 수정"),
    deleteButton(student.id, student.name),
    el("button", { class: "btn-primary", type: "button" },
      el("span", { "aria-hidden": "true" }, "⇩ "), "평가표 내보내기"),
  );

  const scoreStat = (label: string, value: string): HTMLElement =>
    el("div", { class: "score-summary__item" },
      el("span", { class: "score-summary__value num" }, value),
      el("span", { class: "score-summary__label" }, label),
    );

  const addLink = (href: string, label: string): HTMLElement =>
    el("a", { class: "btn-ghost btn-ghost--sm", href }, label);

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
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
              metaItem("수강 과목", student.subjects.join(", ") || "—"),
            ),
          ),
        ),
        heroActions,
      ),

      sectionCard(
        "시간표",
        addLink(`#/students/${student.id}/schedule`, "시간표 편집"),
        tableWithNav(renderScheduleTable(slots), slots.length),
      ),
      sectionCard(
        "시험 성적",
        el("div", { class: "section-card__head-actions" },
          exams.length > 0
            ? el("div", { class: "score-summary" },
                scoreStat("평균", `${scoreSummary.avgPct}%`),
                scoreStat("최고", `${scoreSummary.bestPct}%`),
                scoreStat("횟수", `${scoreSummary.count}회`),
              )
            : null,
          addLink(`#/students/${student.id}/score`, "+ 점수 입력"),
        ),
        tableWithNav(renderExamScoreTable(exams, (xid) => `#/students/${student.id}/score/${xid}/edit`), exams.length),
      ),

      sectionCard(
        "월간 서술 평가 이력",
        addLink(`#/students/${student.id}/evaluate`, "+ 평가 작성"),
        el("div", {},
          renderEvaluationHistory(evaluations, (eid) => `#/students/${student.id}/evaluate/${eid}/edit`),
          renderTableNav(evaluations.length),
        ),
      ),
    ),
  );
}
