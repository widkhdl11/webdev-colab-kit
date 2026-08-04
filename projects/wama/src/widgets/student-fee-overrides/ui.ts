import { el } from "@/shared/lib/dom";
import { formNote, numberInput, withPending } from "@/shared/lib/form";
import { formatWon } from "@/shared/lib/money";
import type { Subject } from "@/entities/subject/model";
import { listSubjects } from "@/entities/subject/repo";
import { listSubjectPrices } from "@/entities/subject/price-repo";
import { pricesForSubject, type SubjectPrice } from "@/entities/subject/price";
import { diffOverrides, MAX_STUDENT_FEE, type StudentSubjectFee } from "@/entities/student/subject-fee";
import { listStudentSubjectFees, saveStudentSubjectFees } from "@/entities/student/subject-fee-repo";

// 학생별 과목 금액 예외 편집 — 형제 감면·개별 할인을 넣는 자리.
// 비워두면 예외 없음(가격표 값을 그대로 씀). 0 을 넣으면 "0원 청구"이며 비운 것과 다르다.
// 위젯인 이유: 학생 수정 폼이 이미 길고, 이 블록은 자기 데이터를 스스로 읽고 저장한다.

// 참고용으로 그 과목의 기본가를 함께 보여준다 — 얼마를 깎는 건지 모르고 숫자만 넣으면 실수한다.
// 고르고 정렬하는 규칙은 entities(pricesForSubject)가 정한다 — 여기선 문장으로 잇기만.
function basePriceHint(prices: readonly SubjectPrice[], subjectId: string): string {
  const forSubject = pricesForSubject(prices, subjectId);
  if (forSubject.length === 0) return "가격표에 등록된 기본가 없음";
  return `기본가 ${forSubject.map((p) => `주${p.sessionsPerWeek}회 ${formatWon(p.monthlyFee)}`).join(" · ")}`;
}

export async function renderStudentFeeOverrides(studentId: string): Promise<HTMLElement> {
  const note = formNote();
  const [subjectsRes, pricesRes, feesRes] = await Promise.all([
    listSubjects(),
    listSubjectPrices(),
    listStudentSubjectFees(studentId),
  ]);

  if (!subjectsRes.ok) {
    return el("p", { class: "form-note form-note--error", role: "alert" }, subjectsRes.error);
  }
  const subjects: readonly Subject[] = subjectsRes.value;
  const prices: readonly SubjectPrice[] = pricesRes.ok ? pricesRes.value : [];
  let saved: readonly StudentSubjectFee[] = feesRes.ok ? feesRes.value : [];
  if (!feesRes.ok) note.show("error", feesRes.error);

  const inputs = new Map<string, HTMLInputElement>();

  function fillInputs(): void {
    for (const [subjectId, input] of inputs) {
      const found = saved.find((f) => f.subjectId === subjectId);
      input.value = found ? String(found.monthlyFee) : "";
    }
  }

  const rows = subjects.map((s) => {
    const input = numberInput(`fee-${s.id}`, "", 0, MAX_STUDENT_FEE);
    input.setAttribute("aria-label", `${s.name} 이 학생의 월정액`);
    input.placeholder = "예외 없음";
    inputs.set(s.id, input);
    return el("tr", {},
      el("th", { scope: "row" }, s.name),
      el("td", { class: "muted-cell" }, basePriceHint(prices, s.id)),
      el("td", {}, input),
    );
  });
  fillInputs();

  const submit = el("button", { class: "btn-primary", type: "button" }, "수강료 예외 저장") as HTMLButtonElement;
  submit.addEventListener("click", () => {
    void withPending(submit, async () => {
      note.clear();
      // 빈칸은 Map 에 넣지 않는다 — "예외 없음"과 "0원 청구"를 구분해야 한다.
      const entered = new Map<string, number>();
      for (const [subjectId, input] of inputs) {
        const raw = input.value.trim();
        if (raw === "") continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) { note.show("error", "금액은 숫자로 입력해주세요."); return; }
        entered.set(subjectId, n);
      }
      const res = await saveStudentSubjectFees(studentId, diffOverrides(saved, entered));
      if (!res.ok) { note.show("error", res.error); return; }
      saved = res.value;
      fillInputs();
      note.show("info", saved.length === 0 ? "예외를 모두 지웠습니다." : `예외 ${saved.length}건을 저장했습니다.`);
    });
  });

  return el("section", { class: "section-card" },
    el("h2", { class: "section-card__title" }, "수강료 예외"),
    el("p", { class: "page__desc" },
      "비워두면 가격표의 기본가로 청구됩니다. 이 학생만 다른 금액을 받을 때만 채우세요. ",
      "0을 넣으면 면제(0원 청구)이며 비워둔 것과 다릅니다."),
    el("div", { class: "table-card" },
      el("div", { class: "table-scroll" },
        el("table", { class: "table" },
          el("caption", { class: "sr-only" }, "과목별 이 학생의 월정액 예외. 과목, 기본가, 예외 금액."),
          el("thead", {},
            el("tr", {},
              el("th", { scope: "col" }, "과목"),
              el("th", { scope: "col" }, "가격표 기본가"),
              el("th", { scope: "col" }, "이 학생 금액(원)"),
            ),
          ),
          el("tbody", {}, ...rows),
        ),
      ),
    ),
    subjects.length === 0
      ? el("p", { class: "page__desc" }, "등록된 과목이 없습니다. 과목 관리에서 먼저 과목을 등록하세요.")
      : el("div", { class: "form-actions" }, submit),
    note.node,
  );
}
