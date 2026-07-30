import { describe, it, expect } from "vitest";
import { parseSubject } from "./model";

// 경계 파싱(스마트 컨스트럭터) 단위 검증 — 서버 응답을 도메인 값으로 승격할 때 불법 상태를 거른다.
describe("parseSubject", () => {
  it("정상 응답을 Subject 로 승격", () => {
    expect(parseSubject({ id: "sub1", name: "미적분" })).toEqual({ id: "sub1", name: "미적분" });
  });

  it("여분 필드(created_at 등)는 무시하고 id/name 만 취한다", () => {
    const s = parseSubject({ id: "sub1", name: "기하", academy_id: "a1", created_at: "2026-07-25" });
    expect(s).toEqual({ id: "sub1", name: "기하" });
  });

  it("필수 필드(name) 누락이면 던진다", () => {
    expect(() => parseSubject({ id: "sub1" })).toThrow();
  });

  it("타입이 틀리면 던진다(id 가 숫자)", () => {
    expect(() => parseSubject({ id: 1, name: "미적분" })).toThrow();
  });

  it("객체가 아니면 던진다", () => {
    expect(() => parseSubject(null)).toThrow();
    expect(() => parseSubject("nope")).toThrow();
  });
});
