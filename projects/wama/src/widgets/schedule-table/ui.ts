import { groupSlots, type ScheduleSlot } from "@/entities/schedule/model";
import { el } from "@/shared/lib/dom";

// 학생 시간표 표. 표시만 — 묶는 규칙은 entities(groupSlots)가 정한다.
// 같은 수업이 요일만 다르면 한 줄 + 요일 칩으로 보여준다. 슬롯당 한 줄로 두면
// 수학을 월·수로 넣었을 때 상세 화면에만 2줄이 떠서 중복처럼 읽힌다(사용자 보고 2026-08-04).
export function renderScheduleTable(slots: ScheduleSlot[]): HTMLElement {
  if (slots.length === 0) {
    return el("p", { class: "empty-note" }, "등록된 시간표가 없습니다.");
  }
  const rows = groupSlots(slots).map((g) =>
    el("tr", {},
      el("td", {}, g.subject),
      el("td", {},
        el("div", { class: "day-cell" },
          ...g.days.map((d) => el("span", { class: "day-chip" }, d.weekday)))),
      el("td", { class: "num" }, `${g.start}–${g.end}`),
      el("td", {}, g.teacher),
    ),
  );
  return el("table", { class: "table" },
    el("caption", { class: "sr-only" }, "학생 시간표. 과목, 요일, 시간대, 담당 선생님."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "과목"),
        el("th", { scope: "col" }, "요일"),
        el("th", { scope: "col" }, "시간"),
        el("th", { scope: "col" }, "담당"),
      ),
    ),
    el("tbody", {}, ...rows),
  );
}
