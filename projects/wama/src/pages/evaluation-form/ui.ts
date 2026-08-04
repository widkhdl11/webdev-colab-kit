import { el } from "@/shared/lib/dom";
import { field, staticField, selectInput, textArea, formNote, withPending } from "@/shared/lib/form";
import { getStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import {
  createEvaluation, updateEvaluation, getEvaluationForEdit,
  type EvaluationInput, type EvaluationEdit,
} from "@/entities/evaluation/repo";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";

// 이번 달(YYYY-MM) — month 입력 기본값.
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderForm(
  student: Student,
  mode: "create" | "edit",
  existing: EvaluationEdit | null,
): HTMLElement {
  const isEdit = mode === "edit";
  const monthInput = el("input", {
    id: "f-month", class: "input input--block", type: "month", value: existing?.month ?? currentMonth(),
  });
  // 평가는 그 학생이 수강 중인 과목(시간표 파생)만 대상으로 한다.
  // 수정 시 기존 평가의 과목이 이제 수강 목록에 없어도(시간표 변경) 옵션에 포함해 조용한 재할당을 막는다.
  const enrolled = student.subjects;
  const selectedSubject = existing?.subject ?? enrolled[0] ?? "";
  const subjectOptions = [...new Set([selectedSubject, ...enrolled].filter(Boolean))];
  const bodyArea = textArea("f-body", existing?.body ?? "", "학습 태도·성취·다음 달 계획을 서술하세요", 8);
  const note = formNote();
  const submit = el("button", { class: "btn-primary", type: "submit" },
    isEdit ? "변경 저장" : "평가 저장") as HTMLButtonElement;

  const hasSubjects = subjectOptions.length > 0;
  const form = el("form", { class: "form-card", novalidate: "" },
    staticField("학생", `${student.name} · ${student.grade}`),
    field("과목", selectInput("f-subject", subjectOptions, selectedSubject),
      hasSubjects ? null
        : el("span", { class: "form-field__hint" },
            "먼저 ", el("a", { href: `#/students/${student.id}/schedule` }, "시간표"), "에서 수강 과목을 등록하세요.")),
    field("평가 월", monthInput),
    staticField("작성 선생님", "김지현 선생님"),
    field("월간 서술 평가", bodyArea),
    note.node,
    el("div", { class: "form-actions" },
      el("a", { class: "btn-ghost", href: `#/students/${student.id}` }, "취소"),
      submit,
    ),
  );
  if (!hasSubjects) submit.disabled = true;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input: EvaluationInput = {
      subject: form.querySelector<HTMLSelectElement>("#f-subject")?.value ?? "",
      month: form.querySelector<HTMLInputElement>("#f-month")?.value ?? "",
      body: bodyArea.value,
    };
    void withPending(submit, async () => {
      note.clear();
      const res = isEdit && existing
        ? await updateEvaluation(existing.id, input)
        : await createEvaluation(student.id, input);
      if (!res.ok) { note.show("error", res.error); return; }
      location.hash = `#/students/${student.id}`;
    });
  });
  return form;
}

// 월간 서술 평가 입력/수정 페이지 — Supabase 에 영구 저장.
export async function mountEvaluationFormPage(
  root: HTMLElement, id: string, mode: "create" | "edit" = "create", evalId?: string,
): Promise<void> {
  const [student, existing] = await Promise.all([
    getStudent(id),
    mode === "edit" && evalId ? getEvaluationForEdit(evalId) : Promise.resolve(null),
  ]);
  const hdr = await getSessionHeader();
  const title = mode === "edit" ? "월간 서술 평가 수정" : "월간 서술 평가 작성";
  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page form-page" },
      el("a", { class: "back-link", href: student ? `#/students/${student.id}` : "#/students" }, "← 돌아가기"),
      el("div", {},
        el("h1", { class: "page__title" }, title),
        el("p", { class: "page__desc" }, "선생님들이 학원 안에서 공유하는 월간 서술 평가입니다. 학부모에게 나가는 이미지에는 포함되지 않습니다."),
      ),
      student
        ? renderForm(student, mode, existing)
        : el("div", { class: "empty-state" },
            el("p", { class: "page__desc" }, `학생(${id})을 찾을 수 없습니다.`)),
    ),
  );
}
