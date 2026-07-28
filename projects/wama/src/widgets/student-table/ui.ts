import { el } from "@/shared/lib/dom";
import type { Student, EvalStatus } from "@/entities/student/model";

const STATUS: Record<EvalStatus, { label: string; cls: string }> = {
  done: { label: "평가완료", cls: "badge badge--done" },
  waiting: { label: "평가대기", cls: "badge badge--wait" },
};

// 학생 목록 표. 표시만 — 정렬/필터/조회 로직은 상위(page/features)에서.
export function renderStudentTable(students: Student[]): HTMLElement {
  const rows = students.map((s) =>
    el("tr", {},
      el("td", {}, el("a", { href: `#/students/${s.id}`, class: "student-name" }, s.name)),
      el("td", {}, s.grade),
      el("td", {}, s.school),
      el("td", {}, s.subjects.join(", ")),
      el("td", { class: "num" }, s.lastEvalMonth),
      el("td", { class: "col-right" }, el("span", { class: STATUS[s.evalStatus].cls }, STATUS[s.evalStatus].label)),
    ),
  );
  return el("table", { class: "table table--rows-link" },
    el("caption", { class: "sr-only" },
      "담당 학생 목록. 이름, 학년, 학교, 수강 과목, 최근 평가월, 상태. 행을 누르면 상세로 이동합니다."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "이름"),
        el("th", { scope: "col" }, "학년"),
        el("th", { scope: "col" }, "학교"),
        el("th", { scope: "col" }, "수강 과목"),
        el("th", { scope: "col" }, "최근 평가월"),
        el("th", { scope: "col", class: "col-right" }, "상태"),
      ),
    ),
    el("tbody", {}, ...rows),
  );
}
