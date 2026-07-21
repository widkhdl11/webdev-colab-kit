// 범용 입력 파싱 (도메인 지식 없음). "3,000" 같은 문자열에서 정수만 뽑는다.
export const parseDigits = (s: string): number => {
  const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
