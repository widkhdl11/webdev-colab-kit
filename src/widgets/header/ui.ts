import { el } from "@/shared/lib/dom";
import { formatPoints } from "@/shared/lib/format";

export interface HeaderProps {
  users: { nickname: string }[];
  currentNick: string;
  balance: number;
  route: string; // 활성 내비 표시용 (예: "#/", "#/new", "#/me")
  onSwitch: (nickname: string) => void;
}

const NAV = [
  { href: "#/", label: "둘러보기" },
  { href: "#/new", label: "펀딩 만들기" },
  { href: "#/me", label: "내 지갑" },
];

// 상단 헤더 — 로고 · 내비 · 데모 계정 전환 · 잔액 pill. 표시/전환만 담당.
export function Header(p: HeaderProps): HTMLElement {
  const isActive = (href: string) => (href === "#/" ? p.route === "#/" || p.route === "" : p.route.startsWith(href));

  const select = el("select", {
    class: "hdr__select", "aria-label": "데모 계정 전환",
    onChange: (e: Event) => p.onSwitch((e.target as HTMLSelectElement).value),
  }, ...p.users.map((u) =>
    el("option", { value: u.nickname, selected: u.nickname === p.currentNick, text: u.nickname })));

  return el("header", { class: "hdr" },
    el("div", { class: "hdr__inner" },
      el("a", { class: "hdr__logo", href: "#/", "aria-label": "포인트펀딩 홈" },
        el("span", { class: "hdr__logo-mark", "aria-hidden": "true", text: "P" }),
        el("span", { text: "포인트펀딩" }),
      ),
      el("nav", { class: "hdr__nav", "aria-label": "주 메뉴" },
        ...NAV.map((n) => {
          const active = isActive(n.href);
          return el("a", {
            class: active ? "hdr__link hdr__link--active" : "hdr__link",
            href: n.href, text: n.label, "aria-current": active ? "page" : undefined,
          });
        }),
      ),
      el("div", { class: "hdr__user" },
        el("span", { class: "hdr__balance", title: "내 포인트 잔액", text: formatPoints(p.balance) }),
        el("span", { class: "hdr__avatar", "aria-hidden": "true", text: p.currentNick.slice(0, 1) }),
        select,
      ),
    ),
  );
}
