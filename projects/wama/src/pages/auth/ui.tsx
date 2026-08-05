import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, FormNote, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { AuthBrand } from "@/widgets/auth-brand/ui";
import { signIn, signUp } from "@/features/auth/api";

export type AuthMode = "login" | "signup";

function Tabs({ mode }: { readonly mode: AuthMode }): ReactNode {
  const tab = (m: AuthMode, label: string, to: string): ReactNode => (
    <Link
      to={to}
      className={`auth-tab${m === mode ? " auth-tab--active" : ""}`}
      aria-current={m === mode ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="auth-tabs">
      {tab("login", "로그인", "/login")}
      {tab("signup", "회원가입", "/signup")}
    </div>
  );
}

function LoginForm(): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: FormEvent): void {
    e.preventDefault();
    note.clear();
    // 비밀번호는 trim 하지 않는다 — 앞뒤 공백도 사용자가 정한 값의 일부다.
    if (!email.trim() || !password) { note.showError("이메일과 비밀번호를 입력해 주세요."); return; }
    void run(async () => {
      const r = await signIn(email.trim(), password);
      if (r.ok) navigate("/students");
      else note.showError(r.error);
    });
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field label="이메일" htmlFor="l-email">
        <TextInput id="l-email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" autoComplete="username" />
      </Field>
      <Field label="비밀번호" htmlFor="l-pw">
        <TextInput id="l-pw" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
      </Field>
      <FormNote note={note.note} />
      <button className="btn-primary btn-block" type="submit" {...busy(pending)}>로그인</button>
      <Link className="auth-sub" to="/login">비밀번호를 잊으셨나요?</Link>
    </form>
  );
}

function SignupForm(): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  function submit(e: FormEvent): void {
    e.preventDefault();
    note.clear();
    if (!name.trim() || !email.trim() || !pw) { note.showError("모든 항목을 입력해 주세요."); return; }
    if (pw !== pw2) { note.showError("비밀번호가 일치하지 않습니다."); return; }
    void run(async () => {
      const r = await signUp(email.trim(), pw, name.trim());
      if (!r.ok) { note.showError(r.error); return; }
      if (r.value.needsConfirm) {
        note.showInfo("확인 메일을 보냈습니다. 메일의 링크로 인증한 뒤 로그인해 주세요.");
      } else {
        navigate("/onboarding");
      }
    });
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field label="이름" htmlFor="s-name">
        <TextInput id="s-name" value={name} onChange={setName} placeholder="선생님 이름" autoComplete="name" />
      </Field>
      <Field label="이메일" htmlFor="s-email">
        <TextInput id="s-email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" autoComplete="username" />
      </Field>
      <Field label="비밀번호" htmlFor="s-pw">
        <TextInput id="s-pw" type="password" value={pw} onChange={setPw} placeholder="6자 이상" autoComplete="new-password" />
      </Field>
      <Field label="비밀번호 확인" htmlFor="s-pw2">
        <TextInput id="s-pw2" type="password" value={pw2} onChange={setPw2} placeholder="비밀번호 재입력" autoComplete="new-password" />
      </Field>
      <FormNote note={note.note} />
      <button className="btn-primary btn-block" type="submit" {...busy(pending)}>회원가입</button>
    </form>
  );
}

// 로그인/회원가입 탭 카드. 인증은 features/auth(서버 Supabase Auth)로 위임.
export function AuthPage({ mode }: { readonly mode: AuthMode }): ReactNode {
  return (
    <main className="auth-page">
      <AuthBrand academyName="온마음수학학원" />
      <section className="auth-card">
        <Tabs mode={mode} />
        {mode === "login" ? <LoginForm /> : <SignupForm />}
      </section>
    </main>
  );
}
