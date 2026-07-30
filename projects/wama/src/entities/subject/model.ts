// 학원이 관리하는 과목. 순수 도메인 — DB/네트워크를 모른다.
// 시간표·평가·성적이 이 과목명을 참조한다(현재 참조는 자유 문자열 — FK 없음).
// Supabase 응답 파싱은 아래 스마트 컨스트럭터로 신뢰 경계에서 1회(supabase.md).
export interface Subject {
  readonly id: string;
  readonly name: string;
}

// 서버 응답(신뢰 경계 밖)을 도메인 값으로 승격. 불법 상태면 던진다.
export function parseSubject(raw: unknown): Subject {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("subject 응답이 객체가 아닙니다");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") {
    throw new Error("subject 응답에 id/name 이 없거나 형식이 잘못됐습니다");
  }
  return { id: r.id, name: r.name };
}
