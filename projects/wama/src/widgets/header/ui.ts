import { el } from "@/shared/lib/dom";

export interface TeacherInfo {
  readonly name: string;
  readonly role?: string; // 데이터 모델에 역할이 없어 선택적 — 없으면 중립 라벨.
}

// 상단 헤더: 좌측 로고+학원명, 우측 내 계정. 표시만 — 로직 없음.
export function renderHeader(academyName: string, teacher: TeacherInfo): HTMLElement {
  const role = teacher.role ?? "선생님";
  return el("header", { class: "app-header" },
    el("div", { class: "container app-header__inner" },
      el("a", { href: "#", class: "brand-mark", "aria-label": `${academyName} 홈` },
        el("span", { class: "brand-logo", "aria-hidden": "true" }, academyName.slice(0, 1)),
        el("span", { class: "brand-name" }, academyName),
      ),
      el("button", {
        class: "account", type: "button", title: "로그아웃",
        "aria-label": `${teacher.name} · 로그아웃`,
        onClick: () => { location.hash = "#/logout"; },
      },
        el("span", { class: "account__meta" },
          el("span", { class: "account__name" }, teacher.name),
          el("span", { class: "account__sub" }, role),
        ),
        el("span", { class: "avatar", "aria-hidden": "true" }, teacher.name.slice(0, 1)),
      ),
    ),
  );
}
