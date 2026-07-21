// 표시용 포맷 유틸 (순수). 도메인 규칙 없음 — 숫자·시간을 사람이 읽는 문자열로만 바꾼다.

export function formatPoints(p: number): string {
  return `${p.toLocaleString("ko-KR")} P`;
}

// 남은 기한. now를 인자로 받아 결정론을 유지한다(테스트 가능).
export function formatRemaining(deadline: number, now: number): string {
  const ms = deadline - now;
  if (ms <= 0) return "마감";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}일 남음`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}시간 남음`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}분 남음`;
}

// 값/최대의 백분율. 표시용으로 0~100에 고정.
export function progressPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}
