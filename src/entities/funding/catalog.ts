// 카테고리 목록 + 카테고리별 썸네일 그라데이션(디자인 승인 팔레트). 펀딩 콘텐츠 설정.
export const CATEGORIES = ["취미", "게임", "음악", "리빙", "패션", "푸드"] as const;
export type Category = (typeof CATEGORIES)[number];

const GRADIENTS: Record<string, string> = {
  취미: "linear-gradient(150deg,#8ea58c,#5f7d68)",
  게임: "linear-gradient(150deg,#8481bd,#524e93)",
  음악: "linear-gradient(150deg,#b18a94,#7e5a68)",
  리빙: "linear-gradient(150deg,#86a6a3,#5a7d7c)",
  패션: "linear-gradient(150deg,#c0a487,#93745a)",
  푸드: "linear-gradient(150deg,#c6ab77,#977a4b)",
};
const DEFAULT_GRADIENT = "linear-gradient(150deg,#9aa0ad,#6b7280)";

export const gradientFor = (category: string): string => GRADIENTS[category] ?? DEFAULT_GRADIENT;
