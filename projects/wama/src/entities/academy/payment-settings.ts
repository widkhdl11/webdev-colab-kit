// 학원의 입금 계좌 + 기본 안내 문구. 수강료 안내 이미지가 이 값을 읽는다.
// docs/specs/payment-notice-export.md (approved) 의 "입력과 검증"·"안내 문구" 규칙을 담는다.
// 순수 도메인 — 네트워크/DOM 을 모른다. 서버 응답 파싱은 아래 스마트 컨스트럭터로 경계에서 1회.

export interface PaymentSettings {
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
  readonly noticeTemplate: string;
}

// 계좌번호는 은행마다 자릿수·구분이 제각각이라 형식 검증은 여기까지가 한계다.
// 대신 오독을 부르는 문자(공백·문자)는 막는다 — 오타 한 글자가 돈을 엉뚱한 데로 보낸다.
const ACCOUNT_RE = /^[0-9-]{8,20}$/;

const LIMITS = { name: 20, template: 500 } as const;

// 미설정은 null 로 온다. 폼이 null 을 다루지 않도록 빈 문자열로 정규화한다.
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parsePaymentSettings(raw: unknown): PaymentSettings {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("학원 결제 설정 응답이 객체가 아닙니다");
  }
  const r = raw as Record<string, unknown>;
  return {
    bankName: str(r.bank_name),
    accountNumber: str(r.account_number),
    accountHolder: str(r.account_holder),
    noticeTemplate: str(r.notice_template),
  };
}

export type PaymentSettingsErrors = Partial<Record<keyof PaymentSettings, string>>;

// 틀린 칸을 전부 모아 돌려준다(하나씩 고치게 하지 않는다).
export function validatePaymentSettings(s: PaymentSettings): PaymentSettingsErrors {
  const errors: PaymentSettingsErrors = {};

  const bank = s.bankName.trim();
  if (bank === "" || bank.length > LIMITS.name) {
    errors.bankName = `은행명을 1~${LIMITS.name}자로 입력해주세요`;
  }

  if (!ACCOUNT_RE.test(s.accountNumber.trim())) {
    errors.accountNumber = "계좌번호는 숫자와 하이픈만 8~20자로 입력해주세요";
  }

  const holder = s.accountHolder.trim();
  if (holder === "" || holder.length > LIMITS.name) {
    errors.accountHolder = `예금주를 1~${LIMITS.name}자로 입력해주세요`;
  }

  const template = s.noticeTemplate.trim();
  if (template === "" || template.length > LIMITS.template) {
    errors.noticeTemplate = `안내 문구를 1~${LIMITS.template}자로 입력해주세요`;
  }

  return errors;
}

// 학원 설정 화면의 완성도 — 네 칸이 다 채워졌는지. 검증과 같은 기준을 쓴다.
export function isPaymentSettingsComplete(s: PaymentSettings): boolean {
  return Object.keys(validatePaymentSettings(s)).length === 0;
}

// 이미지 생성 가능 여부 중 **저장값이 책임지는 부분**만 본다 = 입금 계좌 3종.
// 안내 문구는 내보내기 화면에서 이번 건만 고칠 수 있으므로(스펙 흐름 3), 저장된 문구가 비었다는 이유로
// 생성을 막으면 화면에서 문구를 채워도 버튼이 계속 잠긴다. 문구는 호출부가 **입력칸 값**으로 따로 검사한다.
// 계좌는 여기서 못 고치므로 저장값이 유일한 근거다 — 빈칸이 박힌 이미지가 학부모에게 가면 사고다.
export function isAccountComplete(s: PaymentSettings): boolean {
  const errors = validatePaymentSettings(s);
  return !errors.bankName && !errors.accountNumber && !errors.accountHolder;
}

export type NoticeVars = Readonly<Record<string, string>>;

// 자리표시자 치환. 한 번만 훑으므로 치환값 안의 중괄호는 다시 치환되지 않는다.
// 모르는 자리표시자는 **지우지 않고 그대로 둔다** — 조용히 지우면 문장이 깨진 채 학부모에게 간다.
export function renderNoticeTemplate(template: string, vars: NoticeVars): string {
  return template.replace(/\{([^{}]+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] ?? whole : whole,
  );
}
