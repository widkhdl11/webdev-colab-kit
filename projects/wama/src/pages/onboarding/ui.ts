import { el } from "@/shared/lib/dom";
import { field, inputOf, fieldValue, formNote, withPending } from "@/shared/lib/form";
import { renderAuthBrand } from "@/widgets/auth-brand/ui";
import { createAcademy, joinAcademy } from "@/features/auth/api";

function createForm(): HTMLElement {
  const note = formNote();
  const submit = el("button", { class: "btn-primary btn-block", type: "submit" }, "학원 만들기");
  const form = el("form", { class: "auth-form", novalidate: "" },
    field("학원명", inputOf("o-name", "text", "예: 온마음수학학원", "organization")),
    field("지점명", inputOf("o-branch", "text", "예: 면목점")),
    field("전화번호", inputOf("o-tel", "tel", "예: 02-1234-5678", "tel")),
    note.node,
    submit,
  ) as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.clear();
    const name = fieldValue(form, "o-name");
    if (!name) {
      note.show("error", "학원명을 입력해 주세요.");
      return;
    }
    void withPending(submit, async () => {
      const r = await createAcademy(name, "", fieldValue(form, "o-branch"), fieldValue(form, "o-tel"));
      if (r.ok) location.hash = "#/students";
      else note.show("error", r.error);
    });
  });
  return form;
}

function joinForm(): HTMLElement {
  const note = formNote();
  const submit = el("button", { class: "btn-primary btn-block", type: "submit" }, "참여하기");
  const form = el("form", { class: "auth-form", novalidate: "" },
    field("초대코드", inputOf("o-code", "text", "학원에서 받은 코드")),
    note.node,
    submit,
  ) as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.clear();
    const code = fieldValue(form, "o-code");
    if (!code) {
      note.show("error", "초대코드를 입력해 주세요.");
      return;
    }
    void withPending(submit, async () => {
      const r = await joinAcademy(code, "");
      if (r.ok) location.hash = "#/students";
      else note.show("error", r.error);
    });
  });
  return form;
}

// 학원 연결 스텝(회원가입 직후) — 학원 만들기 / 초대코드 참여. 생성·참여는 서버 RPC로만(INV-A4/A5/A6).
export function mountOnboardingPage(root: HTMLElement): void {
  root.replaceChildren(
    el("main", { class: "auth-page" },
      renderAuthBrand("온마음수학학원"),
      el("section", { class: "auth-card" },
        el("h1", { class: "auth-title" }, "학원 시작하기"),
        el("div", { class: "auth-block" },
          el("h2", { class: "auth-block__title" }, "학원 만들기"),
          createForm(),
        ),
        el("div", { class: "auth-divider" }, el("span", {}, "또는")),
        el("div", { class: "auth-block" },
          el("h2", { class: "auth-block__title" }, "초대코드로 참여"),
          joinForm(),
        ),
      ),
    ),
  );
}
