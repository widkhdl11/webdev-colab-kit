import { el } from "@/shared/lib/dom";
import { field, textInput, numberInput, formNote, withPending } from "@/shared/lib/form";
import { formatWon } from "@/shared/lib/money";
import type { Subject } from "@/entities/subject/model";
import { listSubjects, addSubject, deleteSubject } from "@/entities/subject/repo";
import { MAX_SESSIONS_PER_WEEK, MAX_SUBJECT_FEE, sortPrices, type SubjectPrice } from "@/entities/subject/price";
import {
  listSubjectPrices,
  addSubjectPrice,
  updateSubjectPrice,
  deleteSubjectPrice,
} from "@/entities/subject/price-repo";
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

  // ── 수강료 가격표 ─────────────────────────────────────────────────────────
  // (과목 × 주 횟수) → 월정액. 학생 청구액이 여기서 나온다(스펙 payment-notice-export.md).
  // 가격이 없는 조합은 청구서에서 빈칸이 되고 이미지 생성이 막힌다(INV-PN6) — 그래서 여기서 채워둔다.
  const priceNote = formNote();
  const priceBody = el("tbody", {});
  const priceEmpty = el("p", { class: "page__desc", hidden: "" },
    "아직 등록된 가격이 없습니다. 과목마다 주 횟수별 월정액을 등록하세요.");

  function priceRow(p: SubjectPrice): HTMLElement {
    // 수강료는 해마다 바뀌므로 금액만 그 자리에서 고칠 수 있게 둔다.
    // 주 횟수는 못 바꾼다 — 바꾸면 다른 줄과 충돌할 수 있어 지우고 다시 넣는 편이 명확하다.
    const amount = numberInput(`price-${p.id}`, String(p.monthlyFee), 0, MAX_SUBJECT_FEE);
    amount.setAttribute("aria-label", `${p.subject} 주 ${p.sessionsPerWeek}회 월정액`);
    const save = el("button", { class: "btn-ghost btn-ghost--sm", type: "button" }, "저장");
    const del = el("button", { class: "btn-ghost btn-ghost--sm", type: "button" }, "삭제");

    save.addEventListener("click", () => {
      void withPending(save, async () => {
        priceNote.clear();
        const res = await updateSubjectPrice(p.id, Number(amount.value));
        if (!res.ok) { priceNote.show("error", res.error); return; }
        amount.value = String(res.value.monthlyFee);
        priceNote.show("info", `${p.subject} 주 ${p.sessionsPerWeek}회 = ${formatWon(res.value.monthlyFee)} 로 저장했습니다.`);
      });
    });

    const row = el("tr", {},
      el("th", { scope: "row" }, p.subject),
      el("td", { class: "tnum" }, `주 ${p.sessionsPerWeek}회`),
      el("td", {}, amount),
      el("td", { class: "col-right" }, save, del),
    );

    del.addEventListener("click", () => {
      void withPending(del, async () => {
        priceNote.clear();
        const res = await deleteSubjectPrice(p.id);
        if (!res.ok) { priceNote.show("error", res.error); return; }
        const nextFocus = row.nextElementSibling?.querySelector<HTMLButtonElement>("button")
          ?? row.previousElementSibling?.querySelector<HTMLButtonElement>("button");
        row.remove();
        if (priceBody.children.length === 0) priceEmpty.hidden = false;
        (nextFocus ?? pSubject).focus();
      });
    });
    return row;
  }

  function renderPrices(prices: readonly SubjectPrice[]): void {
    const sorted = sortPrices(prices);
    priceBody.replaceChildren(...sorted.map(priceRow));
    priceEmpty.hidden = sorted.length > 0;
  }

  const priceTable = el("table", { class: "table" },
    el("caption", { class: "sr-only" }, "과목별 주 횟수당 월 수강료. 과목, 주 횟수, 월정액, 저장·삭제."),
    el("thead", {},
      el("tr", {},
        el("th", { scope: "col" }, "과목"),
        el("th", { scope: "col" }, "주 횟수"),
        el("th", { scope: "col" }, "월정액(원)"),
        el("th", { scope: "col", class: "col-right" }, "관리"),
      ),
    ),
    priceBody,
  );

  // 과목 select 는 등록된 과목에서만 고르게 한다 — 자유 입력이면 오타가 곧 "가격 없는 과목"이 된다.
  const pSubject = el("select", { class: "select", id: "price-subject" }) as HTMLSelectElement;
  function fillSubjectOptions(subjects: readonly Subject[]): void {
    pSubject.replaceChildren(...subjects.map((s) => el("option", { value: s.id }, s.name)));
    pSubject.disabled = subjects.length === 0;
  }
  const pSessions = numberInput("price-sessions", "1", 1, MAX_SESSIONS_PER_WEEK);
  const pFee = numberInput("price-fee", "", 0, MAX_SUBJECT_FEE);
  const priceSubmit = el("button", { class: "btn-primary", type: "submit" }, "가격 추가") as HTMLButtonElement;
  const priceForm = el("form", { class: "form-card", novalidate: "" },
    field("과목", pSubject),
    field("주 횟수", pSessions, "같은 과목이라도 주 몇 회 오느냐에 따라 금액이 다릅니다."),
    field("월정액(원)", pFee, "원 단위 정수로 입력합니다. 4주인 달과 5주인 달의 금액은 같습니다."),
    priceNote.node,
    el("div", { class: "form-actions" }, priceSubmit),
  );
  priceForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pSubject.value) { priceNote.show("error", "먼저 과목을 등록하세요."); return; }
    void withPending(priceSubmit, async () => {
      priceNote.clear();
      const res = await addSubjectPrice(pSubject.value, Number(pSessions.value), Number(pFee.value));
      if (!res.ok) { priceNote.show("error", res.error); return; }
      priceBody.append(priceRow(res.value));
      priceEmpty.hidden = true;
      pFee.value = "";
      pFee.focus();
    });
  });

  if (initial.ok) fillSubjectOptions(initial.value);
  const prices = await listSubjectPrices();
  if (prices.ok) renderPrices(prices.value);
  else priceNote.show("error", prices.error);

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
      el("h2", { class: "section-card__title schedule-add__title" }, "수강료 가격표"),
      el("p", { class: "page__desc" },
        "학생 청구액은 이 표에서 자동으로 계산됩니다 — 듣는 과목들의 월정액 합입니다. ",
        "가격이 없는 조합은 안내 이미지에서 빈칸이 되어 생성이 막힙니다."),
      el("div", { class: "table-card" }, el("div", { class: "table-scroll" }, priceTable), priceEmpty),
      priceForm,
    ),
  );
}
