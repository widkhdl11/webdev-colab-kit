import { el } from "@/shared/lib/dom";
import { Header, type HeaderProps } from "@/widgets/header/ui";
import { FundingCard, toCardData, STATUS_BADGE } from "@/widgets/funding-card/ui";
import { formatPoints } from "@/shared/lib/format";
import type { ProjectView, FunderView } from "@/entities/funding/store";

const emptyBox = (text: string) => el("p", { class: "empty__mini", text });

export interface WalletProps {
  header: HeaderProps;
  currentNick: string;
  balance: number;
  created: ProjectView[];
  backed: { project: ProjectView; funder: FunderView }[];
  now: number;
}

// 내 지갑 / 내 펀딩 — 잔액 + 내가 만든 펀딩 + 내가 후원한 펀딩.
export function WalletPage(p: WalletProps): HTMLElement {
  const backedRows = p.backed.map(({ project, funder }) => {
    const badge = STATUS_BADGE[project.status];
    return el("a", { class: "backed__row", href: `#/f/${project.id}` },
      el("span", { class: "backed__thumb", style: `background:${project.gradient}`, "aria-hidden": "true" }),
      el("span", { class: "backed__body" },
        el("span", { class: "backed__title", text: project.title }),
        el("span", { class: "backed__sub", text: `내 후원 ${formatPoints(funder.amount)} · 지분 ${funder.sharePct}%` }),
      ),
      el("span", { class: `badge ${badge.cls}`, text: badge.label }),
    );
  });

  return el("div", {},
    Header(p.header),
    el("main", { class: "page" },
      el("h1", { class: "page-title", text: "내 지갑" }),
      el("div", { class: "balance-card" },
        el("span", { class: "balance-card__label", text: `${p.currentNick} 님의 포인트` }),
        el("span", { class: "balance-card__value", text: formatPoints(p.balance) }),
      ),

      el("section", { class: "section--gap", "aria-label": "내가 만든 펀딩" },
        el("h2", { class: "section-title" }, "내가 만든 펀딩",
          el("span", { class: "section-title__count", text: `${p.created.length}개` })),
        p.created.length > 0
          ? el("div", { class: "grid" }, ...p.created.map((v) => FundingCard(toCardData(v), p.now)))
          : emptyBox("아직 만든 펀딩이 없어요. '펀딩 만들기'에서 시작해보세요."),
      ),

      el("section", { class: "section--gap", "aria-label": "내가 후원한 펀딩" },
        el("h2", { class: "section-title" }, "내가 후원한 펀딩",
          el("span", { class: "section-title__count", text: `${p.backed.length}개` })),
        p.backed.length > 0
          ? el("div", { class: "backed" }, ...backedRows)
          : emptyBox("아직 후원한 펀딩이 없어요. 둘러보기에서 마음에 드는 프로젝트를 찾아보세요."),
      ),
    ),
  );
}
