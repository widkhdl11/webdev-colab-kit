import { el } from "@/shared/lib/dom";
import { field, staticField, textInput, selectInput, formNote, withPending } from "@/shared/lib/form";
import { getStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import { EXAM_KINDS, type Exam, type ExamKind, type SubjectScore } from "@/entities/exam-score/model";
import { createExam, updateExam, getExamForEdit, type ExamInput } from "@/entities/exam-score/repo";
import { listSubjects } from "@/entities/subject/repo";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";

const YEARS = ["2026", "2025", "2024"] as const;
const SEMESTERS = ["1학기", "2학기"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 정기고사(중간/기말)는 연도+학기로 식별, 비정기(학원/모의)는 이름+날짜로 식별.
function isIrregular(kind: string): boolean {
  return kind === "학원" || kind === "모의";
}

interface ScoreRowRef {
  readonly node: HTMLElement;
  readonly getSubject: () => string;
  readonly score: HTMLInputElement;
  readonly max: HTMLInputElement;
}

function numCell(ariaLabel: string, value: string, placeholder: string): HTMLInputElement {
  return el("input", {
    class: "input", type: "number", min: "0", max: "1000", inputmode: "numeric",
    value, placeholder, "aria-label": ariaLabel,
  });
}

// 과목별 점수 한 행. 수강 과목은 라벨, "과목 추가"로 넣는 행은 과목 select(학원 과목 목록).
function scoreRow(
  fixedSubject: string | null, idx: number, subjectNames: string[],
  scoreVal = "", maxVal = "100",
): ScoreRowRef {
  const label = fixedSubject ?? "추가 과목";
  const select = fixedSubject == null
    ? selectInput(`f-subj-${idx}`, subjectNames.length > 0 ? subjectNames : [""], subjectNames[0] ?? "")
    : null;
  const subjCell = fixedSubject != null
    ? el("span", { class: "score-grid__subject" }, fixedSubject)
    : (select as HTMLSelectElement);
  if (select) select.setAttribute("aria-label", "추가 과목");
  const score = numCell(`${label} 점수`, scoreVal, "점수");
  const max = numCell(`${label} 만점`, maxVal, "만점");
  return {
    node: el("div", { class: "score-grid__row" }, subjCell, score, max),
    getSubject: () => (fixedSubject != null ? fixedSubject : (select as HTMLSelectElement).value),
    score,
    max,
  };
}

// 수정 시 기존 시험 식별값을 폼 필드로 역파싱. 정기="YYYY 학기", 비정기 period="YYYY.MM.DD".
function prefill(existing: Exam | null): { year: string; semester: string; name: string; date: string } {
  if (!existing) return { year: "2026", semester: "1학기", name: "", date: todayISO() };
  if (isIrregular(existing.kind)) {
    return { year: "2026", semester: "1학기", name: existing.examName, date: existing.period.replaceAll(".", "-") };
  }
  const [year = "2026", semester = "1학기"] = existing.period.split(" ");
  return { year, semester, name: "", date: todayISO() };
}

function renderForm(student: Student, mode: "create" | "edit", subjectNames: string[], existing: Exam | null): HTMLElement {
  const isEdit = mode === "edit";
  const pre = prefill(existing);
  const kind = selectInput("f-kind", EXAM_KINDS, existing?.kind ?? "중간");

  const yearField = field("년도", selectInput("f-year", YEARS, pre.year));
  const semField = field("학기", selectInput("f-sem", SEMESTERS, pre.semester));
  const nameField = field("시험명", textInput("f-exam", pre.name, "예: 7월 학원 모의고사"));
  const dateField = field("시기", el("input", {
    id: "f-date", class: "input input--block", type: "date", value: pre.date,
  }));
  const syncKind = (): void => {
    const irr = isIrregular(kind.value);
    yearField.hidden = irr;
    semField.hidden = irr;
    nameField.hidden = !irr;
    dateField.hidden = !irr;
  };
  kind.addEventListener("change", syncKind);

  // 과목별 점수 그리드. 수정 시 기존 점수를 프리필, 신규는 수강 과목을 라벨 행으로.
  const rows: ScoreRowRef[] = [];
  const grid = el("div", { class: "score-grid" },
    el("div", { class: "score-grid__head" },
      el("span", {}, "과목"), el("span", {}, "점수"), el("span", {}, "만점"),
    ),
  );
  let rowIdx = 0;
  const addRow = (r: ScoreRowRef): void => { rows.push(r); grid.append(r.node); };

  if (existing && existing.scores.length > 0) {
    existing.scores.forEach((s: SubjectScore) => addRow(scoreRow(s.subject, rowIdx++, subjectNames, String(s.score), String(s.max))));
  } else {
    const base = student.subjects.length > 0 ? student.subjects : subjectNames.slice(0, 1);
    base.forEach((s) => addRow(scoreRow(s, rowIdx++, subjectNames)));
  }

  const addBtn = el("button", { class: "btn-ghost btn-ghost--sm", type: "button" }, "+ 과목 추가");
  addBtn.addEventListener("click", () => addRow(scoreRow(null, rowIdx++, subjectNames)));

  const note = formNote();
  const submit = el("button", { class: "btn-primary", type: "submit" },
    isEdit ? "변경 저장" : "점수 저장") as HTMLButtonElement;

  const form = el("form", { class: "form-card", novalidate: "" },
    staticField("학생", `${student.name} · ${student.grade}`),
    field("시험 종류", kind),
    yearField, semField, nameField, dateField,
    el("div", { class: "form-field" },
      el("span", { class: "form-field__label" }, "과목별 점수"),
      grid,
      addBtn,
    ),
    note.node,
    el("div", { class: "form-actions" },
      el("a", { class: "btn-ghost", href: `#/students/${student.id}` }, "취소"),
      submit,
    ),
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const k = kind.value as ExamKind;
    const irr = isIrregular(k);
    const examName = irr
      ? (form.querySelector<HTMLInputElement>("#f-exam")?.value ?? "").trim()
      : `${form.querySelector<HTMLSelectElement>("#f-sem")?.value ?? ""} ${k}고사`;
    const period = irr
      ? (form.querySelector<HTMLInputElement>("#f-date")?.value ?? "").replaceAll("-", ".")
      : `${form.querySelector<HTMLSelectElement>("#f-year")?.value ?? ""} ${form.querySelector<HTMLSelectElement>("#f-sem")?.value ?? ""}`;
    // 빈 점수는 NaN 으로 보내 repo 필터(Number.isFinite)가 미응시 행을 실제로 걸러내게 한다.
    // (Number("")===0 이면 0점이 저장돼 통계 평균을 오염시킨다.)
    const scores: SubjectScore[] = rows.map((r) => ({
      subject: r.getSubject(),
      score: r.score.value.trim() === "" ? NaN : Number(r.score.value),
      max: Number(r.max.value) || 100,
    }));
    const input: ExamInput = { examName, kind: k, period, scores };

    void withPending(submit, async () => {
      note.clear();
      const res = isEdit && existing
        ? await updateExam(existing.id, input)
        : await createExam(student.id, input);
      if (!res.ok) { note.show("error", res.error); return; }
      location.hash = `#/students/${student.id}`;
    });
  });

  syncKind(); // 초기: 기본 중간(정기) → 년도·학기 노출, 시험명·시기 숨김
  return form;
}

// 시험 점수 입력/수정 페이지 — Supabase 에 영구 저장(시험+점수 원자적 RPC).
export async function mountScoreFormPage(
  root: HTMLElement, id: string, mode: "create" | "edit" = "create", examId?: string,
): Promise<void> {
  const [student, subjRes, existing] = await Promise.all([
    getStudent(id),
    listSubjects(),
    mode === "edit" && examId ? getExamForEdit(examId) : Promise.resolve(null),
  ]);
  const subjectNames = subjRes.ok ? subjRes.value.map((s) => s.name) : [];
  const hdr = await getSessionHeader();
  const title = mode === "edit" ? "시험 점수 수정" : "시험 점수 입력";
  const desc = mode === "edit"
    ? "이 시험의 과목별 점수를 수정합니다."
    : "한 시험의 과목별 점수를 한 번에 입력합니다.";
  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page form-page" },
      el("a", { class: "back-link", href: student ? `#/students/${student.id}` : "#/students" }, "← 돌아가기"),
      el("div", {},
        el("h1", { class: "page__title" }, title),
        el("p", { class: "page__desc" }, desc),
      ),
      student
        ? renderForm(student, mode, subjectNames, existing)
        : el("div", { class: "empty-state" },
            el("p", { class: "page__desc" }, `학생(${id})을 찾을 수 없습니다.`)),
    ),
  );
}
