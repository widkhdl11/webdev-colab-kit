import { el } from "@/shared/lib/dom";

// 로그인 전 중앙 브랜드 마크 (로고 사각형 + 학원명). 앱 헤더와 별개 — 표시만.
export function renderAuthBrand(academyName: string): HTMLElement {
  return el("div", { class: "auth-brand" },
    el("span", { class: "auth-brand__logo", "aria-hidden": "true" }, academyName.slice(0, 1)),
    el("span", { class: "auth-brand__name" }, academyName),
  );
}
