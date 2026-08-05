import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Field, FormNote, TextArea, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import {
  validatePaymentSettings,
  isPaymentSettingsComplete,
  renderNoticeTemplate,
  type PaymentSettings,
} from "@/entities/academy/payment-settings";
import { getPaymentSettings, savePaymentSettings } from "@/entities/academy/repo";

// 학원 설정 — 입금 계좌 + 수강료 안내 기본 문구. 수강료 안내 이미지가 이 값을 읽는다.
// 스펙 payment-notice-export.md: 계좌가 비면 이미지 생성을 막고 이 화면으로 안내한다.
// 승인된 폼 언어의 반복이라 시안 없이 구현(빠른 경로) — 시각 기준은 design-rules.md.

const PLACEHOLDER_HINT = "{학생명} {월} {금액} 은 이미지를 만들 때 실제 값으로 바뀝니다.";

const SAMPLE = { 학생명: "김서연", 월: "8월", 금액: "450,000" } as const;

const EMPTY: PaymentSettings = { bankName: "", accountNumber: "", accountHolder: "", noticeTemplate: "" };

export function AcademySettingsPage(): ReactNode {
  const note = useFormNote();
  const { pending, run } = usePending();
  const [values, setValues] = useState<PaymentSettings>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getPaymentSettings().then((res) => {
      if (!alive) return;
      if (res.ok) setValues(res.value);
      else note.showError(res.error);
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: FormEvent): void {
    e.preventDefault();
    // 저장 전에 화면에서 한 번 거른다 — 서버·DB CHECK 가 최종 방어선이고 여기는 즉시 피드백용.
    const trimmed: PaymentSettings = {
      bankName: values.bankName.trim(),
      accountNumber: values.accountNumber.trim(),
      accountHolder: values.accountHolder.trim(),
      noticeTemplate: values.noticeTemplate.trim(),
    };
    const firstError = Object.values(validatePaymentSettings(trimmed))[0];
    if (firstError) { note.showError(firstError); return; }
    void run(async () => {
      note.clear();
      const res = await savePaymentSettings(trimmed);
      if (!res.ok) { note.showError(res.error); return; }
      setValues(res.value);
      note.showInfo("저장했습니다.");
    });
  }

  // 자리표시자가 실제로 어떻게 치환되는지 즉시 보여준다 — 문구가 이미지로 굳기 전에 확인하게.
  const template = values.noticeTemplate.trim();
  const preview = template === "" ? "" : `미리보기 — ${renderNoticeTemplate(template, SAMPLE)}`;

  return (
    <main className="container page form-page">
      <Link className="back-link" to="/students">← 학원생 목록</Link>
      <div>
        <h1 className="page__title">학원 설정</h1>
        <p className="page__desc">학부모에게 보내는 수강료 안내 이미지에 들어갈 입금 계좌와 기본 문구입니다.</p>
      </div>

      {/* 미설정 안내. 계좌가 비어 있으면 안내 이미지를 못 만든다는 사실을 이 화면에서 알려준다. */}
      <p className="form-note form-note--info" role="status" hidden={loading || isPaymentSettingsComplete(values)}>
        입금 계좌와 안내 문구를 모두 채워야 수강료 안내 이미지를 만들 수 있습니다.
      </p>

      <form className="form-card" noValidate onSubmit={submit}>
        <h2 className="section-card__title">입금 계좌</h2>
        <Field label="은행" htmlFor="pay-bank">
          <TextInput id="pay-bank" value={values.bankName} onChange={(v) => set("bankName", v)} placeholder="예: 국민은행" />
        </Field>
        <Field label="계좌번호" htmlFor="pay-account" hint={<span className="form-field__hint">숫자와 하이픈만 입력합니다.</span>}>
          <TextInput id="pay-account" value={values.accountNumber} onChange={(v) => set("accountNumber", v)} placeholder="예: 123456-01-234567" />
        </Field>
        <Field label="예금주" htmlFor="pay-holder">
          <TextInput id="pay-holder" value={values.accountHolder} onChange={(v) => set("accountHolder", v)} placeholder="예: 온학원" />
        </Field>

        <h2 className="section-card__title">안내 문구</h2>
        <Field label="기본 안내 문구" htmlFor="pay-template" hint={<span className="form-field__hint">{PLACEHOLDER_HINT}</span>}>
          <TextArea
            id="pay-template"
            value={values.noticeTemplate}
            onChange={(v) => set("noticeTemplate", v)}
            placeholder="안녕하세요, {학생명} 학부모님. {월} 수강료 {금액}원을 입금 부탁드립니다."
            rows={5}
          />
        </Field>
        <p className="page__desc">{preview}</p>

        <FormNote note={note.note} />
        <div className="form-actions">
          <button className="btn-primary" type="submit" {...busy(pending)}>저장</button>
        </div>
      </form>
    </main>
  );
}
