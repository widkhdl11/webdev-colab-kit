// 금액 표기·검증의 단일 구현. 도메인 개념 없음(어느 프로젝트에나 옮겨도 동작) — 상한은 호출부가 넘긴다.
// 같은 규칙을 도메인마다 손으로 다시 적으면 한쪽만 고쳐지고 금액이 갈라진다.

// 원 단위 정수만 인정한다. 부동소수 오차가 청구액에 섞이면 안 된다.
export function isIntegerAmount(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

// 천 단위 콤마 + "원". 한글 병기 없음(계약서 관례라 안내문엔 과함).
export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}
