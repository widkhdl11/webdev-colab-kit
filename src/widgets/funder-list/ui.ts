import { el } from "@/shared/lib/dom";
import { formatPoints } from "@/shared/lib/format";

// 한 후원자 행의 표시 데이터. sharePct(지분 %)는 상위(도메인/피처)에서 계산해 넘겨준다.
export interface FunderRow {
  name: string;
  amount: number;
  sharePct: number;
}

// 후원자 현황 — 상위 후원자 목록 + 지분 %. 표시만 담당.
export function FunderList(rows: FunderRow[], moreCount: number): HTMLElement {
  const total = rows.length + moreCount;
  return el("section", { "aria-label": "후원자 현황" },
    el("h2", { class: "section-title" },
      "후원자 현황",
      el("span", { class: "section-title__count", text: `${total.toLocaleString("ko-KR")}명` }),
    ),
    el("div", { class: "funders" },
      ...rows.map((r) =>
        el("div", { class: "funder" },
          el("span", { class: "funder__avatar", "aria-hidden": "true", text: r.name.slice(0, 1) }),
          el("span", { class: "funder__name", text: r.name }),
          el("span", { class: "funder__amount", text: formatPoints(r.amount) }),
          el("span", { class: "funder__share", text: `${r.sharePct}%` }),
        ),
      ),
    ),
    moreCount > 0
      ? el("p", { class: "funders__more", text: `외 ${moreCount.toLocaleString("ko-KR")}명이 함께했어요` })
      : null,
  );
}
