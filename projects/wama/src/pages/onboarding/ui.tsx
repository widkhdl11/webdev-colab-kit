import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Field, FormNote, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { AuthBrand } from "@/widgets/auth-brand/ui";
import { createAcademy, joinAcademy } from "@/features/auth/api";

function CreateForm(): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [phone, setPhone] = useState("");

  function submit(e: FormEvent): void {
    e.preventDefault();
    note.clear();
    if (!name.trim()) { note.showError("학원명을 입력해 주세요."); return; }
    void run(async () => {
      const r = await createAcademy(name.trim(), "", branch.trim(), phone.trim());
      if (r.ok) navigate("/students");
      else note.showError(r.error);
    });
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field label="학원명" htmlFor="o-name">
        <TextInput id="o-name" value={name} onChange={setName} placeholder="예: 온마음수학학원" autoComplete="organization" />
      </Field>
      <Field label="지점명" htmlFor="o-branch">
        <TextInput id="o-branch" value={branch} onChange={setBranch} placeholder="예: 면목점" />
      </Field>
      <Field label="전화번호" htmlFor="o-tel">
        <TextInput id="o-tel" value={phone} onChange={setPhone} type="tel" placeholder="예: 02-1234-5678" autoComplete="tel" />
      </Field>
      <FormNote note={note.note} />
      <button className="btn-primary btn-block" type="submit" {...busy(pending)}>학원 만들기</button>
    </form>
  );
}

function JoinForm(): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const [code, setCode] = useState("");

  function submit(e: FormEvent): void {
    e.preventDefault();
    note.clear();
    if (!code.trim()) { note.showError("초대코드를 입력해 주세요."); return; }
    void run(async () => {
      const r = await joinAcademy(code.trim(), "");
      if (r.ok) navigate("/students");
      else note.showError(r.error);
    });
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field label="초대코드" htmlFor="o-code">
        <TextInput id="o-code" value={code} onChange={setCode} placeholder="학원에서 받은 코드" />
      </Field>
      <FormNote note={note.note} />
      <button className="btn-primary btn-block" type="submit" {...busy(pending)}>참여하기</button>
    </form>
  );
}

// 학원 연결 스텝(회원가입 직후) — 학원 만들기 / 초대코드 참여. 생성·참여는 서버 RPC로만(INV-A4/A5/A6).
export function OnboardingPage(): ReactNode {
  return (
    <main className="auth-page">
      <AuthBrand academyName="온마음수학학원" />
      <section className="auth-card">
        <h1 className="auth-title">학원 시작하기</h1>
        <div className="auth-block">
          <h2 className="auth-block__title">학원 만들기</h2>
          <CreateForm />
        </div>
        <div className="auth-divider"><span>또는</span></div>
        <div className="auth-block">
          <h2 className="auth-block__title">초대코드로 참여</h2>
          <JoinForm />
        </div>
      </section>
    </main>
  );
}
