// 펀딩 표시/입력 규칙 (순수). 지분 추정·개설 검증 등 도메인 판단을 한곳에 모아 UI가 표시만 하게 한다.
// 실제 원자적 차감·정산은 model.ts + (향후) 서버 RPC 책임. 여기는 클라이언트 프리뷰 판단만.

// 예상 지분 % — amount를 더 넣었을 때 내 몫 비율(표시용, 소수 첫째자리).
export const expectedSharePct = (raised: number, amount: number): number =>
  amount > 0 ? Math.round((amount / (raised + amount)) * 1000) / 10 : 0;

export interface DraftInput {
  title: string;
  target: number;
  rewardPool: number;
  balance: number;
  hasDeadline: boolean;
}

// 개설 폼 검증 — 위반 메시지 목록을 돌려준다(비면 유효). 무엇이 유효한 펀딩인가는 도메인 판단.
export function validateFundingDraft(d: DraftInput): string[] {
  const errors: string[] = [];
  if (d.title.trim().length < 2) errors.push("제목을 입력해주세요");
  if (d.target < 1) errors.push("목표 포인트는 1 이상이어야 해요");
  if (d.rewardPool > d.balance) errors.push("보상풀이 내 잔액보다 많아요");
  if (!d.hasDeadline) errors.push("마감일을 선택해주세요");
  return errors;
}
