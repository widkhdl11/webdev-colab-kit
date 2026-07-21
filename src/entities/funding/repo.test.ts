import { describe, it, expect } from "vitest";
import { MemoryRepo } from "./repo";

// env와 무관하게 MemoryRepo를 직접 검증한다(싱글턴 repo는 .env 유무로 구현이 갈리므로 사용 안 함).
// 스토어 로직 자체는 store.test, 여기선 리포지토리→스토어 배선만.
describe("MemoryRepo (인메모리)", () => {
  const repo = new MemoryRepo();

  it("load: 6개 프로젝트 + 내 지갑 파생 + 잔액", async () => {
    const s = await repo.load("민서");
    expect(s.projects.length).toBe(6);
    expect(s.myCreated.some((p) => p.id === "f3")).toBe(true); // 민서가 만든 성공 펀딩
    expect(s.users.find((u) => u.nickname === "민서")?.balance).toBe(12_500);
  });

  it("contribute가 실제 상태를 바꾼다 (f1 4500 → 100% 달성)", async () => {
    const r = await repo.contribute("f1", "민서", 4_500);
    expect(r.ok).toBe(true);
    const s = await repo.load("민서");
    const f1 = s.projects.find((p) => p.id === "f1");
    expect(f1?.status).toBe("SUCCESS");
    expect(f1?.raised).toBe(30_000);
  });
});
