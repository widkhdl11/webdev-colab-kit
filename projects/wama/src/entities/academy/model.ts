// 학원 값 객체. 격리 단위이며 지점(branch)·전화는 표시 필드(결정 2026-07-24).
// 순수 도메인 — 네트워크/DB를 모른다. Supabase 응답 파싱은 아래 스마트 컨스트럭터로 경계에서 1회.
export interface Academy {
  readonly id: string;
  readonly name: string;
  readonly joinCode: string;
  readonly branch: string | null;
  readonly phone: string | null;
}

// 신뢰 경계 밖(서버 응답)을 도메인 값으로 승격. 불법 상태면 던진다(supabase.md: 경계에서 파싱·검증).
export function parseAcademy(raw: unknown): Academy {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("academy 응답이 객체가 아닙니다");
  }
  const r = raw as Record<string, unknown>;
  const { id, name, join_code: joinCode } = r;
  if (typeof id !== "string" || typeof name !== "string" || typeof joinCode !== "string") {
    throw new Error("academy 응답에 id/name/join_code 가 없거나 형식이 잘못됐습니다");
  }
  return {
    id,
    name,
    joinCode,
    branch: typeof r.branch === "string" ? r.branch : null,
    phone: typeof r.phone === "string" ? r.phone : null,
  };
}
