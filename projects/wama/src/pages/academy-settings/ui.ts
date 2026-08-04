import { el } from "@/shared/lib/dom";
import { field, textInput, textArea, fieldValue, formNote, withPending } from "@/shared/lib/form";
import {
  validatePaymentSettings,
  isPaymentSettingsComplete,
  renderNoticeTemplate,
  type PaymentSettings,
} from "@/entities/academy/payment-settings";
import { getPaymentSettings, savePaymentSettings } from "@/entities/academy/repo";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader } from "@/features/auth/api";

// 학원 설정 — 입금 계좌 + 수강료 안내 기본 문구. 수강료 안내 이미지가 이 값을 읽는다.
// 스펙 payment-notice-export.md: 계좌가 비면 이미지 생성을 막고 이 화면으로 안내한다.
// 승인된 폼 언어의 반복이라 시안 없이 구현(빠른 경로) — 시각 기준은 design-rules.md.

const PLACEHOLDER_HINT = "{학생명} {월} {금액} 은 이미지를 만들 때 실제 값으로 바뀝니다.";

const SAMPLE = { 학생명: "김서연", 월: "8월", 금액: "450,000" } as const;

export async function mountAcademySettingsPage(root: HTMLElement): Promise<void> {
  const note = formNote();

  const fBank = textInput("pay-bank", "", "예: 국민은행");
  const fAccount = textInput("pay-account", "", "예: 123456-01-234567");
  const fHolder = textInput("pay-holder", "", "예: 온학원");
  const fTemplate = textArea(
    "pay-template",
    "",
    "안녕하세요, {학생명} 학부모님. {월} 수강료 {금액}원을 입금 부탁드립니다.",
    5,
  );

  // 자리표시자가 실제로 어떻게 치환되는지 즉시 보여준다 — 문구가 이미지로 굳기 전에 확인하게.
  const preview = el("p", { class: "page__desc" }, "");
  function refreshPreview(): void {
    const t = fTemplate.value.trim();
    preview.textContent = t === "" ? "" : `미리보기 — ${renderNoticeTemplate(t, SAMPLE)}`;
  }
  fTemplate.addEventListener("input", refreshPreview);

  // 미설정 안내. 계좌가 비어 있으면 안내 이미지를 못 만든다는 사실을 이 화면에서 알려준다.
  const incomplete = el(
    "p",
    { class: "form-note form-note--info", role: "status", hidden: "" },
    "입금 계좌와 안내 문구를 모두 채워야 수강료 안내 이미지를 만들 수 있습니다.",
  );
  function refreshCompleteness(current: PaymentSettings): void {
    incomplete.hidden = isPaymentSettingsComplete(current);
  }

  function currentValues(form: HTMLFormElement): PaymentSettings {
    return {
      bankName: fieldValue(form, "pay-bank"),
      accountNumber: fieldValue(form, "pay-account"),
      accountHolder: fieldValue(form, "pay-holder"),
      noticeTemplate: fieldValue(form, "pay-template"),
    };
  }

  const submit = el("button", { class: "btn-primary", type: "submit" }, "저장") as HTMLButtonElement;
  const form = el(
    "form",
    { class: "form-card", novalidate: "" },
    el("h2", { class: "section-card__title" }, "입금 계좌"),
    field("은행", fBank),
    field("계좌번호", fAccount, "숫자와 하이픈만 입력합니다."),
    field("예금주", fHolder),
    el("h2", { class: "section-card__title" }, "안내 문구"),
    field("기본 안내 문구", fTemplate, PLACEHOLDER_HINT),
    preview,
    note.node,
    el("div", { class: "form-actions" }, submit),
  ) as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = currentValues(form);
    const errors = validatePaymentSettings(values);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      note.show("error", firstError);
      return;
    }
    void withPending(submit, async () => {
      note.clear();
      const res = await savePaymentSettings(values);
      if (!res.ok) {
        note.show("error", res.error);
        return;
      }
      fill(res.value);
      note.show("info", "저장했습니다.");
    });
  });

  function fill(s: PaymentSettings): void {
    fBank.value = s.bankName;
    fAccount.value = s.accountNumber;
    fHolder.value = s.accountHolder;
    fTemplate.value = s.noticeTemplate;
    refreshPreview();
    refreshCompleteness(s);
  }

  const [initial, hdr] = await Promise.all([getPaymentSettings(), getSessionHeader()]);
  if (initial.ok) {
    fill(initial.value);
  } else {
    note.show("error", initial.error);
  }

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el(
      "main",
      { class: "container page form-page" },
      el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
      el(
        "div",
        {},
        el("h1", { class: "page__title" }, "학원 설정"),
        el(
          "p",
          { class: "page__desc" },
          "학부모에게 보내는 수강료 안내 이미지에 들어갈 입금 계좌와 기본 문구입니다.",
        ),
      ),
      incomplete,
      form,
    ),
  );
}
