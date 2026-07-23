import { el } from "@/shared/lib/dom";
import type { ScheduleSlot } from "@/entities/schedule/model";

// 학생 시간표 표. 표시만 — 정렬/편집 로직은 상위(page/features)에서.
export function renderScheduleTable(slots: ScheduleSlot[]): HTMLElement {
  if (slots.length === 0) {
    return el("p", { class: "empty-note" }, "등록된 시간표가 없습니다.");
  }
  const rows = slots.map((s) =>
    el("tr", {},
      el("td", {}, s.subject),
      el("td", {}, el("span", { class: "day-chip" }, s.weekday)),
      el("td", { class: "num" }, `${s.start}–${s.end}`),
      el("td", {}, s.teacher),
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
