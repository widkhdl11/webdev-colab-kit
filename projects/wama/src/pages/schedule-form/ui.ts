import { el } from "@/shared/lib/dom";
import { field, textInput, selectInput, formNote, withPending } from "@/shared/lib/form";
import { getStudent } from "@/entities/student/repo";
import { getSchedule, createSlot, deleteSlot } from "@/entities/schedule/repo";
import type { ScheduleSlot, Weekday } from "@/entities/schedule/model";
import { listSubjects } from "@/entities/subject/repo";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";

const WEEKDAYS: readonly Weekday[] = ["월", "화", "수", "목", "금", "토", "일"];
const dayOrder = (d: Weekday): number => WEEKDAYS.indexOf(d);

// 같은 과목·시간·담당을 한 줄로 묶어 요일 칩 여러 개로 보여준다(승인 시안의 표시 언어).
// DB 는 요일당 1행이므로 한 묶음 = 여러 slot id. 삭제는 그 묶음의 slot 을 모두 지운다.
interface SlotGroup {
  readonly subject: string;
  readonly start: string;
  readonly end: string;
  readonly teacher: string;
  readonly days: { weekday: Weekday; id: string }[];
}

function groupKey(s: ScheduleSlot): string {
  return `${s.subject}|${s.start}|${s.end}|${s.teacher}`;
}

function groupSlots(slots: readonly ScheduleSlot[]): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  for (const s of slots) {
    const key = groupKey(s);
    let g = map.get(key);
    if (!g) { g = { subject: s.subject, start: s.start, end: s.end, teacher: s.teacher, days: [] }; map.set(key, g); }
    g.days.push({ weekday: s.weekday, id: s.id });
  }
  for (const g of map.values()) g.days.sort((a, b) => dayOrder(a.weekday) - dayOrder(b.weekday));
  return [...map.values()];
}

export async function mountScheduleFormPage(root: HTMLElement, id: string): Promise<void> {
  const student = await getStudent(id);
  const backHref = student ? `#/students/${student.id}` : "#/students";
  const hdr = await getSessionHeader();

  if (!student) {
    root.replaceChildren(
      renderHeader(hdr.academyName, { name: hdr.teacherName }),
      el("main", { class: "container page" },
        el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
        el("div", { class: "empty-state" }, el("p", { class: "page__desc" }, `학생(${id})을 찾을 수 없습니다.`)),
      ),
    );
    return;
  }

  const [initialSlots, subjRes] = await Promise.all([getSchedule(id), listSubjects()]);
  const dbNames = subjRes.ok ? subjRes.value.map((s) => s.name) : [];
  // 과목 옵션: 학원 과목 전체 + 학생이 이미 듣는 과목(합집합) — 새 과목을 붙이는 화면이므로.
  const subjOpts = [...new Set([...dbNames, ...student.subjects])];

  const note = formNote();
  const slots: ScheduleSlot[] = [...initialSlots]; // 화면의 단일 출처. 추가/삭제 시 여기서 갱신 후 재렌더.
  const tbody = el("tbody", {});

  // 한 묶음(과목·시간·담당) 행. 삭제는 그 묶음의 모든 요일 slot 을 지운다.
  function groupRow(g: SlotGroup): HTMLElement {
    const del = el("button", { class: "btn-ghost btn-ghost--sm", type: "button" }, "삭제") as HTMLButtonElement;
    del.setAttribute("aria-label", `${g.subject} ${g.days.map((d) => d.weekday).join("·")} 슬롯 삭제`);
    del.addEventListener("click", () => {
      void withPending(del, async () => {
        note.clear();
        const failed: string[] = [];
        for (const d of g.days) {
          const res = await deleteSlot(d.id);
          if (res.ok) {
            const i = slots.findIndex((s) => s.id === d.id);
            if (i >= 0) slots.splice(i, 1);
          } else failed.push(res.error);
        }
        if (failed.length > 0) { note.show("error", failed[0] ?? "삭제 실패"); }
        renderRows();
      });
    });
    return el("tr", {},
      el("td", {}, g.subject),
      el("td", {}, el("div", { class: "day-cell" }, ...g.days.map((d) => el("span", { class: "day-chip" }, d.weekday)))),
      el("td", { class: "num" }, `${g.start}–${g.end}`),
      el("td", {}, g.teacher || "미정"),
      el("td", { class: "col-right" }, del),
    );
  }

  function renderRows(): void {
    tbody.replaceChildren(...groupSlots(slots).map(groupRow));
  }
  renderRows();

  const table = el("table", { class: "table" },
    el("caption", { class: "sr-only" }, "시간표 슬롯. 과목, 요일, 시간, 담당, 삭제."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "과목"),
        el("th", { scope: "col" }, "요일"),
        el("th", { scope: "col" }, "시간"),
        el("th", { scope: "col" }, "담당"),
        el("th", { scope: "col", class: "col-right" }, "삭제"),
      ),
    ),
    tbody,
  );

  const hasSubjects = subjOpts.length > 0;
  const fSubj = selectInput("sl-subj", subjOpts, subjOpts[0] ?? "");
  const fStart = el("input", { id: "sl-start", class: "input input--block", type: "time", value: "17:00" });
  const fEnd = el("input", { id: "sl-end", class: "input input--block", type: "time", value: "18:30" });
  const fTeacher = textInput("sl-teacher", "", "담당 선생님");

  const dayBoxes = WEEKDAYS.map((d) => ({ d, cb: el("input", { type: "checkbox", value: d }) }));
  const dayField = el("div", { class: "form-field" },
    el("span", { class: "form-field__label" }, "요일 (여러 개 선택 가능)"),
    el("div", { class: "day-checks" },
      ...dayBoxes.map(({ d, cb }) => el("label", { class: "day-check" }, cb, el("span", {}, d))),
    ),
  );

  const submit = el("button", { class: "btn-primary", type: "submit" }, "슬롯 추가") as HTMLButtonElement;
  if (!hasSubjects) submit.disabled = true;

  const addForm = el("form", { class: "form-card", novalidate: "" },
    field("과목", fSubj, hasSubjects ? null
      : el("span", { class: "form-field__hint" },
          "먼저 ", el("a", { href: "#/subjects" }, "과목 관리"), "에서 과목을 등록하세요.")),
    dayField,
    el("div", { class: "form-row" }, field("시작", fStart), field("종료", fEnd)),
    field("담당 선생님", fTeacher),
    note.node,
    el("div", { class: "form-actions" }, submit),
  );
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const selected = dayBoxes.filter((b) => b.cb.checked);
    if (selected.length === 0) { note.show("error", "요일을 하나 이상 선택하세요."); return; }
    if (fEnd.value <= fStart.value) { note.show("error", "종료 시간이 시작 시간보다 늦어야 합니다."); return; }
    void withPending(submit, async () => {
      note.clear();
      // 선택한 요일마다 slot 1개씩 저장. 성공한 요일은 즉시 체크 해제 → 부분 실패 후 재제출 중복 방지.
      const failures: string[] = [];
      for (const b of selected) {
        const res = await createSlot(id, {
          subject: fSubj.value, weekday: b.d, start: fStart.value, end: fEnd.value, teacher: fTeacher.value,
        });
        if (res.ok) { slots.push(res.value); b.cb.checked = false; }
        else failures.push(`${b.d}: ${res.error}`);
      }
      renderRows();
      if (failures.length > 0) { note.show("error", failures.join(" / ")); return; }
      fTeacher.value = "";
    });
  });

  root.replaceChildren(
    renderHeader("온마음수학학원", { name: "김지현 선생님", role: "담임 · 중등부" }),
    el("main", { class: "container page detail" },
      el("a", { class: "back-link", href: backHref }, "← 돌아가기"),
      el("div", {},
        el("h1", { class: "page__title" }, "시간표 관리"),
        el("p", { class: "page__desc" }, `${student.name} · ${student.grade} — 수강 과목·시간을 여기서 관리합니다.`),
      ),
      el("div", { class: "table-card" }, el("div", { class: "table-scroll" }, table)),
      el("h2", { class: "section-card__title schedule-add__title" }, "슬롯 추가"),
      addForm,
      el("div", { class: "form-actions" },
        el("a", { class: "btn-ghost", href: backHref }, "완료"),
      ),
    ),
  );
}
