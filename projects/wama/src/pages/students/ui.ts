import { el } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";
import { listStudents } from "@/entities/student/repo";
import { summarizeEvaluations } from "@/entities/student/model";
import type { Student } from "@/entities/student/model";
import { renderHeader } from "@/widgets/header/ui";
import { renderStudentTable } from "@/widgets/student-table/ui";

function statCard(label: string, value: HTMLElement, extra?: Child): HTMLElement {
  return el("div", { class: "stat" }, el("div", { class: "stat__label" }, label), value, extra);
}

function renderStats(students: Student[]): HTMLElement {
  const { total, done, pct } = summarizeEvaluations(students);

  return el("section", { class: "stats", "aria-label": "요약 지표" },
    statCard("총 담당 학생",
      el("div", { class: "stat__value" }, el("span", { class: "num" }, String(total)), el("small", {}, " 명")),
    ),
    statCard("이번 달 평가 완료",
      el("div", { class: "stat__value" }, el("span", { class: "num" }, String(done)), el("small", {}, ` / ${total}명`)),
      el("div", {
        class: "progress", role: "progressbar",
        "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100",
        "aria-label": `이번 달 평가 완료율 ${pct}%`,
      }, el("div", { class: "progress__bar", style: `width:${pct}%` })),
    ),
    statCard("다가오는 시험",
      el("div", { class: "stat__value stat__value--sm" }, "7월 모의고사 ", el("small", {}, "· D-5 (7/26 토)")),
      el("div", { class: "stat__note" }, "대상 중3 · 대비반 24명"),
    ),
  );
}

function renderToolbar(): HTMLElement {
  const search = el("label", { class: "field" },
    el("span", { class: "sr-only" }, "학생 이름 검색"),
    el("input", { type: "search", class: "input", placeholder: "이름으로 검색" }),
  );
  const gradeFilter = el("label", {},
    el("span", { class: "sr-only" }, "학년 필터"),
    el("select", { class: "select" },
      el("option", {}, "전체 학년"),
      el("option", {}, "중1"), el("option", {}, "중2"), el("option", {}, "중3"),
      el("option", {}, "고1"), el("option", {}, "고2"), el("option", {}, "고3"),
    ),
  );
  const subjectFilter = el("label", {},
    el("span", { class: "sr-only" }, "과목 필터"),
    el("select", { class: "select" },
      el("option", {}, "전체 과목"),
      el("option", {}, "수학(공통)"), el("option", {}, "미적분"),
      el("option", {}, "확률과 통계"), el("option", {}, "기하"),
    ),
  );
  const addBtn = el("a", { class: "btn-primary", href: "#/students/new" }, "+ 학생 등록");
  return el("section", { class: "toolbar" },
    el("div", { class: "toolbar__filters" }, search, gradeFilter, subjectFilter),
    addBtn,
  );
}

function renderPagination(total: number): HTMLElement {
  return el("div", { class: "pagination" },
    el("span", { class: "num" }, `전체 ${total}명 중 1–${total}`),
    el("nav", { class: "pagination__pages", "aria-label": "페이지 이동" },
      el("button", { class: "page-btn", type: "button", "aria-label": "이전 페이지" }, "이전"),
      el("button", { class: "page-btn page-btn--active num", type: "button", "aria-current": "page" }, "1"),
      el("button", { class: "page-btn", type: "button", "aria-label": "다음 페이지" }, "다음"),
    ),
  );
}

// 학원생 목록 페이지 조합 (표시만 — 데이터는 repo에서, 판단 로직 없음).
export async function mountStudentsPage(root: HTMLElement): Promise<void> {
  const students = await listStudents();
  root.replaceChildren(
    renderHeader("온마음수학학원", { name: "김지현 선생님", role: "담임 · 중등부" }),
    el("main", { class: "container page" },
      el("div", {},
        el("h1", { class: "page__title" }, "학원생 목록"),
        el("p", { class: "page__desc" }, "담당 학생을 훑어보고, 이름을 눌러 상세로 이동하세요."),
      ),
      renderStats(students),
      renderToolbar(),
      el("div", { class: "table-card" },
        renderStudentTable(students),
        renderPagination(students.length),
      ),
    ),
  );
}
