import { el } from "@/shared/lib/dom";
import { field, textInput, formNote, withPending } from "@/shared/lib/form";
import type { Subject } from "@/entities/subject/model";
import { listSubjects, addSubject, deleteSubject } from "@/entities/subject/repo";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";

// 과목 관리 페이지 (학원 단위 설정) — Supabase 에 영구 저장. 격리는 서버 RLS.
// 과목을 엔티티로 관리(추가·삭제). 시간표·평가·성적이 이 과목명을 참조한다.
export async function mountSubjectsPage(root: HTMLElement): Promise<void> {
  const note = formNote();

  const tbody = el("tbody", {});
  const empty = el("p", { class: "page__desc", hidden: "" }, "아직 등록된 과목이 없습니다. 아래에서 추가하세요.");

  // 한 과목 행. 삭제는 서버에 반영 후 행을 제거. 실패 시 note 로 알리고 행 유지.
  function subjRow(s: Subject): HTMLElement {
    const del = el("button", { class: "btn-ghost btn-ghost--sm", type: "button" }, "삭제");
    const row = el("tr", {},
      el("td", {}, s.name),
      el("td", { class: "col-right" }, del),
    );
    del.addEventListener("click", () => {
      void withPending(del, async () => {
        note.clear();
        const res = await deleteSubject(s.id);
        if (!res.ok) { note.show("error", res.error); return; }
        // 삭제 성공 후 포커스가 사라진 버튼째 제거되므로, 다음 행 삭제 버튼(없으면 과목명 입력)으로 옮긴다.
        const nextDel = row.nextElementSibling?.querySelector<HTMLButtonElement>("button")
          ?? row.previousElementSibling?.querySelector<HTMLButtonElement>("button");
        row.remove();
        if (tbody.children.length === 0) empty.hidden = false;
        (nextDel ?? fName).focus();
      });
    });
    return row;
  }

  function render(subjects: Subject[]): void {
    tbody.replaceChildren(...subjects.map(subjRow));
    empty.hidden = subjects.length > 0;
  }

  const initial = await listSubjects();
  const hdr = await getSessionHeader();
  if (initial.ok) {
    render(initial.value);
  } else {
    note.show("error", initial.error);
  }

  const table = el("table", { class: "table" },
    el("caption", { class: "sr-only" }, "학원 과목 목록. 과목명, 삭제."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "과목명"),
        el("th", { scope: "col", class: "col-right" }, "삭제"),
      ),
    ),
    tbody,
  );

  const fName = textInput("subj-name", "", "예: 초등 수학");
  const submit = el("button", { class: "btn-primary", type: "submit" }, "과목 추가") as HTMLButtonElement;
  const addForm = el("form", { class: "form-card", novalidate: "" },
    field("과목명", fName),
    note.node,
    el("div", { class: "form-actions" }, submit),
  );
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = fName.value.trim();
    if (!v) { note.show("error", "과목명을 입력하세요."); return; }
    void withPending(submit, async () => {
      note.clear();
      const res = await addSubject(v);
      if (!res.ok) { note.show("error", res.error); return; }
      tbody.append(subjRow(res.value));
      empty.hidden = true;
      fName.value = "";
      fName.focus();
    });
  });

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page form-page" },
      el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
      el("div", {},
        el("h1", { class: "page__title" }, "과목 관리"),
        el("p", { class: "page__desc" }, "학원이 가르치는 과목을 관리합니다. 시간표·평가·성적에서 이 과목들을 사용합니다."),
      ),
      el("div", { class: "table-card" }, el("div", { class: "table-scroll" }, table), empty),
      el("h2", { class: "section-card__title schedule-add__title" }, "과목 추가"),
      addForm,
    ),
  );
}
