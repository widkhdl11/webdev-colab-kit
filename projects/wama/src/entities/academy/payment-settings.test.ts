import { describe, it, expect } from "vitest";
import {
  parsePaymentSettings,
  validatePaymentSettings,
  isPaymentSettingsComplete,
  renderNoticeTemplate,
  type PaymentSettings,
} from "./payment-settings";

// docs/specs/payment-notice-export.md (approved 2026-08-03) 의 "입력과 검증" 표 + 안내 문구 규칙.
// 관련 불변식: INV-PN2(금액 정수는 tuition 몫) · INV-PN4(생성 차단 조건) — 여기서는 계좌·문구 쪽을 맡는다.
// 계좌 정보가 비면 이미지 생성을 막아야 한다: "계좌 없는 입금 안내는 무의미하고,
// 빈칸이 박힌 이미지가 학부모에게 가면 사고다"(스펙 성공/실패).

const ok: PaymentSettings = {
  bankName: "국민은행",
  accountNumber: "123456-01-234567",
  accountHolder: "온학원",
  noticeTemplate: "안녕하세요, {학생명} 학부모님. {월} 수강료 {금액}원을 입금 부탁드립니다.",
};

describe("parsePaymentSettings — 서버 응답을 도메인 값으로 (경계 파싱)", () => {
  it("스네이크 케이스 응답을 승격한다", () => {
    expect(
      parsePaymentSettings({
        bank_name: "국민은행",
        account_number: "123456-01-234567",
        account_holder: "온학원",
        notice_template: "안내",
      }),
    ).toEqual({
      bankName: "국민은행",
      accountNumber: "123456-01-234567",
      accountHolder: "온학원",
      noticeTemplate: "안내",
    });
  });

  it("미설정(null) 은 빈 문자열로 정규화한다 — 폼이 null 을 다루지 않게", () => {
    const s = parsePaymentSettings({ bank_name: null, account_number: null, account_holder: null, notice_template: null });
    expect(s).toEqual({ bankName: "", accountNumber: "", accountHolder: "", noticeTemplate: "" });
  });

  it("필드가 아예 없어도 빈 문자열 (신규 학원)", () => {
    expect(parsePaymentSettings({})).toEqual({
      bankName: "",
      accountNumber: "",
      accountHolder: "",
      noticeTemplate: "",
    });
  });

  it("객체가 아니면 던진다", () => {
    expect(() => parsePaymentSettings(null)).toThrow();
    expect(() => parsePaymentSettings("nope")).toThrow();
  });
});

describe("validatePaymentSettings — 저장 전 검증", () => {
  it("정상 입력은 통과", () => {
    expect(validatePaymentSettings(ok)).toEqual({});
  });

  it("계좌번호는 숫자·하이픈만 — 오타 한 글자가 돈을 엉뚱한 데로 보낸다", () => {
    expect(validatePaymentSettings({ ...ok, accountNumber: "123456-01-23456a" }).accountNumber).toBeDefined();
    expect(validatePaymentSettings({ ...ok, accountNumber: "1234 5678 9012" }).accountNumber).toBeDefined();
    expect(validatePaymentSettings({ ...ok, accountNumber: "123-456-789" }).accountNumber).toBeUndefined();
  });

  it("계좌번호 길이는 8~20자 (하이픈 포함)", () => {
    expect(validatePaymentSettings({ ...ok, accountNumber: "1234567" }).accountNumber).toBeDefined();
    expect(validatePaymentSettings({ ...ok, accountNumber: "1".repeat(21) }).accountNumber).toBeDefined();
    expect(validatePaymentSettings({ ...ok, accountNumber: "12345678" }).accountNumber).toBeUndefined();
  });

  it("은행·예금주는 1~20자", () => {
    expect(validatePaymentSettings({ ...ok, bankName: "" }).bankName).toBeDefined();
    expect(validatePaymentSettings({ ...ok, bankName: "가".repeat(21) }).bankName).toBeDefined();
    expect(validatePaymentSettings({ ...ok, accountHolder: "  " }).accountHolder).toBeDefined();
  });

  it("안내 문구는 1~500자", () => {
    expect(validatePaymentSettings({ ...ok, noticeTemplate: "" }).noticeTemplate).toBeDefined();
    expect(validatePaymentSettings({ ...ok, noticeTemplate: "가".repeat(501) }).noticeTemplate).toBeDefined();
  });

  it("여러 칸이 틀리면 전부 돌려준다 (하나씩 고치게 하지 않는다)", () => {
    const errors = validatePaymentSettings({ bankName: "", accountNumber: "x", accountHolder: "", noticeTemplate: "" });
    expect(Object.keys(errors).sort()).toEqual(["accountHolder", "accountNumber", "bankName", "noticeTemplate"]);
  });
});

describe("isPaymentSettingsComplete — 이미지 생성 가능 여부", () => {
  it("계좌 3종과 문구가 다 있으면 true", () => {
    expect(isPaymentSettingsComplete(ok)).toBe(true);
  });

  it("하나라도 비면 false — 빈칸이 박힌 청구 이미지가 학부모에게 가면 사고다", () => {
    expect(isPaymentSettingsComplete({ ...ok, accountNumber: "" })).toBe(false);
    expect(isPaymentSettingsComplete({ ...ok, bankName: "" })).toBe(false);
    expect(isPaymentSettingsComplete({ ...ok, accountHolder: "" })).toBe(false);
    expect(isPaymentSettingsComplete({ ...ok, noticeTemplate: "" })).toBe(false);
  });

  it("공백만 있는 것도 비어 있는 것으로 본다", () => {
    expect(isPaymentSettingsComplete({ ...ok, accountHolder: "   " })).toBe(false);
  });

  it("형식이 잘못된 계좌번호도 미완성으로 본다 (저장을 우회해 들어온 값 방어)", () => {
    expect(isPaymentSettingsComplete({ ...ok, accountNumber: "없음" })).toBe(false);
  });
});

describe("renderNoticeTemplate — 자리표시자 치환", () => {
  const vars = { 학생명: "김서연", 월: "8월", 금액: "450,000" };

  it("{학생명} {월} {금액} 을 치환한다", () => {
    expect(renderNoticeTemplate("{학생명} 학부모님, {월} 수강료 {금액}원입니다.", vars)).toBe(
      "김서연 학부모님, 8월 수강료 450,000원입니다.",
    );
  });

  it("같은 자리표시자가 여러 번 나와도 모두 치환한다", () => {
    expect(renderNoticeTemplate("{학생명}, {학생명}", vars)).toBe("김서연, 김서연");
  });

  it("모르는 자리표시자는 지우지 않고 그대로 둔다 — 조용히 지우면 문장이 깨진 채 학부모에게 간다", () => {
    expect(renderNoticeTemplate("{학생명} / {납부기한}", vars)).toBe("김서연 / {납부기한}");
  });

  it("자리표시자가 없으면 원문 그대로", () => {
    expect(renderNoticeTemplate("이번 달도 감사합니다.", vars)).toBe("이번 달도 감사합니다.");
  });

  it("치환값이 자리표시자 모양이어도 재치환하지 않는다 (한 번만 훑는다)", () => {
    expect(renderNoticeTemplate("{학생명}", { ...vars, 학생명: "{월}" })).toBe("{월}");
  });
});
