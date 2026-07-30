import { describe, it, expect } from "vitest";
import { parseAcademy } from "./model";

// 경계 파싱(스마트 컨스트럭터) 단위 검증 — 서버 응답을 도메인 값으로 승격할 때 불법 상태를 거른다.
describe("parseAcademy", () => {
  it("정상 응답을 Academy로 승격(branch/phone 포함)", () => {
    const a = parseAcademy({ id: "a1", name: "온마음", join_code: "ABC123", branch: "면목점", phone: "02-1" });
    expect(a).toEqual({ id: "a1", name: "온마음", joinCode: "ABC123", branch: "면목점", phone: "02-1" });
  });

  it("branch/phone 누락 시 null로 정규화", () => {
    const a = parseAcademy({ id: "a1", name: "온마음", join_code: "ABC123" });
    expect(a.branch).toBeNull();
    expect(a.phone).toBeNull();
  });

  it("필수 필드(join_code) 누락이면 던진다", () => {
    expect(() => parseAcademy({ id: "a1", name: "온마음" })).toThrow();
  });

  it("타입이 틀리면 던진다(id가 숫자)", () => {
    expect(() => parseAcademy({ id: 1, name: "온마음", join_code: "X" })).toThrow();
  });

  it("객체가 아니면 던진다", () => {
    expect(() => parseAcademy(null)).toThrow();
    expect(() => parseAcademy("nope")).toThrow();
  });
});
