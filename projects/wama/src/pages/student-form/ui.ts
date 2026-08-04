import { el } from "@/shared/lib/dom";
import { field, textInput, selectInput, staticField, formNote, withPending } from "@/shared/lib/form";
import { getStudentProfile, createStudent, updateStudent, type StudentInput } from "@/entities/student/repo";
import {
  ageFromBirthDate, gradeFromBirthDate, gradeNumberOf, effectiveGrade, GRADE_LADDER,
} from "@/entities/student/model";
import type { StudentProfile } from "@/entities/student/model";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";
import { renderStudentFeeOverrides } from "@/widgets/student-fee-overrides/ui";

type Mode = "create" | "edit";

// 보정 오프셋 = 지정 학년 번호 − 표준(생년월일 파생) 학년 번호. 매년 표준이 오르면 보정 학년도 함께 오른다.
// 표준 학년이 범위 밖(null)이거나 미지정이면 0(표준).
function computeGradeOffset(birthDate: string, overrideOn: boolean, selectedGrade: string): number {
  if (!overrideOn || !birthDate) return 0;
  const base = gradeFromBirthDate(birthDate, new Date());
  const baseNum = base ? gradeNumberOf(base) : null;
  const selNum = gradeNumberOf(selectedGrade);
  if (baseNum == null || selNum == null) return 0;
  return selNum - baseNum;
}

function ageLabel(birthDate: string): string {
  const age = ageFromBirthDate(birthDate, new Date());
  return age == null ? "날짜를 확인하세요" : `만 ${age}세`;
}

function autoGradeLabel(birthDate: string): string {
  if (!birthDate) return "생년월일을 입력하면 학년이 자동 계산됩니다";
  const g = gradeFromBirthDate(birthDate, new Date());
  return g == null ? "표준 학년 범위를 벗어남 — 직접 지정하세요" : `자동 학년: ${g} (생년월일 기준)`;
}

// 학년 블록 — 기본은 생년월일 자동. "직접 지정"을 켜면 select 로 보정(유급·조기입학 등).
// 보정은 오프셋으로 저장되어 매년 자동 진급하므로, 그 점을 안내한다.
function gradeBlock(birth: HTMLInputElement, profile: StudentProfile | null): HTMLElement {
  const hasOverride = profile ? profile.gradeOffset !== 0 : false;
  const currentEffective = profile
    ? effectiveGrade(profile.birthDate, profile.gradeOffset, new Date())
    : "중1";

  const autoText = el("div", { class: "form-field__hint", id: "f-grade-auto", role: "status" },
    autoGradeLabel(profile?.birthDate ?? ""));

  const overrideBox = el("input", { id: "f-grade-override", type: "checkbox" });
  if (hasOverride) overrideBox.setAttribute("checked", "");
  const overrideToggle = el("label", { class: "checkbox-row" },
    overrideBox,
    el("span", {}, "학년 직접 지정 (유급·조기입학·빠른년생 등 예외)"),
  );

  const gradeSelect = selectInput("f-grade", GRADE_LADDER, currentEffective);
  gradeSelect.setAttribute("aria-label", "직접 지정 학년");
  const overrideWrap = el("div", { class: "grade-override" },
    gradeSelect,
    el("span", { class: "form-field__hint" }, "지정한 학년도 매년 한 학년씩 자동으로 올라갑니다."),
  );

  const syncOverride = (): void => {
    const on = overrideBox.checked;
    overrideWrap.hidden = !on;
    gradeSelect.disabled = !on;
  };
  overrideBox.addEventListener("change", syncOverride);
  syncOverride();

  // 생년월일이 바뀌면 자동 학년 안내를 갱신 (보정 미사용 시 실효 학년의 근거).
  birth.addEventListener("input", () => {
    autoText.textContent = autoGradeLabel(birth.value);
  });

  return el("div", { class: "form-field" },
    el("span", { class: "form-field__label" }, "학년"),
    autoText,
    overrideToggle,
    overrideWrap,
  );
}

function renderForm(mode: Mode, profile: StudentProfile | null): HTMLElement {
  const p = profile;
  const birth = el("input", {
    id: "f-birth", class: "input input--block", type: "date",
    value: p?.birthDate ?? "", "aria-describedby": "f-birth-age",
  });

  // 만 나이는 생년월일에서 파생(자동) — 폼 확인용, 목록/상세 표엔 노출하지 않는다(privacy).
  // role=status(=aria-live polite): 날짜 입력 후 갱신되는 나이를 스크린리더가 통지한다.
  const ageHint = el("span", { class: "form-field__hint", id: "f-birth-age", role: "status" },
    p ? ageLabel(p.birthDate) : "생년월일을 입력하면 나이가 자동 계산됩니다");
  birth.addEventListener("input", () => {
    ageHint.textContent = birth.value ? ageLabel(birth.value) : "생년월일을 입력하면 나이가 자동 계산됩니다";
  });

  const note = formNote();
  const submit = el("button", { class: "btn-primary", type: "submit" },
    mode === "create" ? "학생 등록" : "변경 저장") as HTMLButtonElement;

  const form = el("form", { class: "form-card", novalidate: "" },
    field("이름", textInput("f-name", p?.name ?? "", "학생 이름")),
    field("생년월일", birth, ageHint),
    gradeBlock(birth, p),
    field("학교", textInput("f-school", p?.school ?? "", "예: 서일중학교")),
    // 과목은 여기서 받지 않는다 — 한 학생이 여러 과목을 과목마다 다른 요일·시간에 듣는다(1:N).
    // 수강 과목·시간은 시간표 등록에서 관리한다.
    staticField("수강 과목", "등록 후 시간표에서 추가합니다 (과목마다 요일·시간)"),
    note.node,
    el("div", { class: "form-actions" },
      el("a", { class: "btn-ghost", href: backHref(mode, p) }, "취소"),
      submit,
    ),
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input: StudentInput = {
      name: (form.querySelector<HTMLInputElement>("#f-name")?.value ?? ""),
      birthDate: (form.querySelector<HTMLInputElement>("#f-birth")?.value ?? ""),
      gradeOffset: computeGradeOffset(
        birth.value,
        form.querySelector<HTMLInputElement>("#f-grade-override")?.checked ?? false,
        form.querySelector<HTMLSelectElement>("#f-grade")?.value ?? "",
      ),
      school: (form.querySelector<HTMLInputElement>("#f-school")?.value ?? ""),
    };
    void withPending(submit, async () => {
      note.clear();
      if (mode === "edit" && p) {
        const res = await updateStudent(p.id, input);
        if (!res.ok) { note.show("error", res.error); return; }
        location.hash = `#/students/${p.id}`;
      } else {
        const res = await createStudent(input);
        if (!res.ok) { note.show("error", res.error); return; }
        location.hash = `#/students/${res.value}`;
      }
    });
  });
  return form;
}

function backHref(mode: Mode, p: StudentProfile | null): string {
  return mode === "edit" && p ? `#/students/${p.id}` : "#/students";
}

// 학생 등록/수정 폼 페이지 조합 (표시만 — 데이터는 repo에서, 저장 로직 없음).
export async function mountStudentFormPage(root: HTMLElement, mode: Mode, id?: string): Promise<void> {
  const profile = mode === "edit" && id ? await getStudentProfile(id) : null;
  const hdr = await getSessionHeader();
  const isMissing = mode === "edit" && !profile;

  const title = mode === "create" ? "학생 등록" : "학생 정보 수정";
  const desc = mode === "create"
    ? "새 학생을 학원에 등록합니다. 나이·학년은 생년월일에서 자동 계산됩니다."
    : "학생의 기본 정보를 수정합니다.";

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page form-page" },
      el("a", { class: "back-link", href: backHref(mode, profile) }, "← 돌아가기"),
      el("div", {},
        el("h1", { class: "page__title" }, title),
        el("p", { class: "page__desc" }, desc),
      ),
      isMissing
        ? el("div", { class: "empty-state" },
            el("p", { class: "page__desc" }, `학생(${id ?? ""})을 찾을 수 없습니다.`))
        : renderForm(mode, profile),
      // 수강료 예외는 학생이 존재해야 붙는다 — 등록 화면에는 아직 학생 id 가 없다.
      // 등록 직후 수정 화면으로 오면 그때 편집한다.
      ...(mode === "edit" && profile ? [await renderStudentFeeOverrides(profile.id)] : []),
    ),
  );
}
