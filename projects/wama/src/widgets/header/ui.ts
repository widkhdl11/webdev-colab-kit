import { el } from "@/shared/lib/dom";

export interface TeacherInfo {
  readonly name: string;
  readonly role: string;
}

// 상단 헤더: 좌측 로고+학원명, 우측 내 계정. 표시만 — 로직 없음.
export function renderHeader(academyName: string, teacher: TeacherInfo): HTMLElement {
  return el("header", { class: "app-header" },
    el("div", { class: "container app-header__inner" },
      el("a", { href: "#", class: "brand-mark", "aria-label": `${academyName} 홈` },
        el("span", { class: "brand-logo", "aria-hidden": "true" }, academyName.slice(0, 1)),
        el("span", { class: "brand-name" }, academyName),
      ),
      el("button", { class: "account", type: "button", "aria-haspopup": "menu" },
        el("span", { class: "account__meta" },
          el("span", { class: "account__name" }, teacher.name),
          el("span", { class: "account__sub" }, teacher.role),
        ),
        el("span", { class: "avatar", "aria-hidden": "true" }, teacher.name.slice(0, 1)),
      ),
    ),
  );
}
