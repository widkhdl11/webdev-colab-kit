import { el } from "@/shared/lib/dom";
import { field, inputOf, fieldValue, formNote, withPending } from "@/shared/lib/form";
import { renderAuthBrand } from "@/widgets/auth-brand/ui";
import { signIn, signUp } from "@/features/auth/api";

type Mode = "login" | "signup";

function tabs(mode: Mode): HTMLElement {
  const tab = (m: Mode, label: string, href: string): HTMLElement => {
    const props: Record<string, unknown> = { class: `auth-tab${m === mode ? " auth-tab--active" : ""}`, href };
    if (m === mode) props["aria-current"] = "page";
    return el("a", props, label);
  };
  return el("div", { class: "auth-tabs" },
    tab("login", "로그인", "#/login"),
    tab("signup", "회원가입", "#/signup"),
  );
}

function loginForm(): HTMLElement {
  const note = formNote();
  const submit = el("button", { class: "btn-primary btn-block", type: "submit" }, "로그인");
  const form = el("form", { class: "auth-form", novalidate: "" },
    field("이메일", inputOf("l-email", "email", "name@example.com", "username")),
    field("비밀번호", inputOf("l-pw", "password", "••••••••", "current-password")),
    note.node,
    submit,
    el("a", { class: "auth-sub", href: "#/login" }, "비밀번호를 잊으셨나요?"),
  ) as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.clear();
    const email = fieldValue(form, "l-email");
    const password = fieldValue(form, "l-pw", { trim: false });
    if (!email || !password) {
      note.show("error", "이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    void withPending(submit, async () => {
      const r = await signIn(email, password);
      if (r.ok) location.hash = "#/students";
      else note.show("error", r.error);
    });
  });
  return form;
}

function signupForm(): HTMLElement {
  const note = formNote();
  const submit = el("button", { class: "btn-primary btn-block", type: "submit" }, "회원가입");
  const form = el("form", { class: "auth-form", novalidate: "" },
    field("이름", inputOf("s-name", "text", "선생님 이름", "name")),
    field("이메일", inputOf("s-email", "email", "name@example.com", "username")),
    field("비밀번호", inputOf("s-pw", "password", "6자 이상", "new-password")),
    field("비밀번호 확인", inputOf("s-pw2", "password", "비밀번호 재입력", "new-password")),
    note.node,
    submit,
  ) as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.clear();
    const name = fieldValue(form, "s-name");
    const email = fieldValue(form, "s-email");
    const pw = fieldValue(form, "s-pw", { trim: false });
    const pw2 = fieldValue(form, "s-pw2", { trim: false });
    if (!name || !email || !pw) {
      note.show("error", "모든 항목을 입력해 주세요.");
      return;
    }
    if (pw !== pw2) {
      note.show("error", "비밀번호가 일치하지 않습니다.");
      return;
    }
    void withPending(submit, async () => {
      const r = await signUp(email, pw, name);
      if (!r.ok) {
        note.show("error", r.error);
        return;
      }
      if (r.value.needsConfirm) {
        note.show("info", "확인 메일을 보냈습니다. 메일의 링크로 인증한 뒤 로그인해 주세요.");
      } else {
        location.hash = "#/onboarding";
      }
    });
  });
  return form;
}

// 로그인/회원가입 탭 카드. 인증은 features/auth(서버 Supabase Auth)로 위임.
export function mountAuthPage(root: HTMLElement, mode: Mode): void {
  root.replaceChildren(
    el("main", { class: "auth-page" },
      renderAuthBrand("온마음수학학원"),
      el("section", { class: "auth-card" },
        tabs(mode),
        mode === "login" ? loginForm() : signupForm(),
      ),
    ),
  );
}
