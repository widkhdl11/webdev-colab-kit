import { el } from "@/shared/lib/dom";
import { Header, type HeaderProps } from "@/widgets/header/ui";
import { FundingPanel, type PanelData } from "@/widgets/funding-panel/ui";
import { FunderList, type FunderRow } from "@/widgets/funder-list/ui";
import { STATUS_BADGE } from "@/widgets/funding-card/ui";
import { CAP, maxParticipatable, type ProjectView } from "@/entities/funding/store";

function notFound(header: HeaderProps): HTMLElement {
  return el("div", {},
    Header(header),
    el("main", { class: "page" },
      el("a", { class: "backlink", href: "#/", text: "← 둘러보기로" }),
      el("div", { class: "empty" },
        el("p", { class: "empty__title", text: "펀딩을 찾을 수 없어요" }),
        el("a", { class: "btn btn--primary", href: "#/", text: "둘러보기로 가기" }),
      ),
    ),
  );
}

export interface DetailProps {
  header: HeaderProps;
  project: ProjectView | null;
  currentNick: string;
  balance: number;
  onContribute: (amount: number) => void;
  now: number;
}

// 펀딩 상세 — 좌: 대표 이미지·소개·후원자 현황 / 우: sticky 후원 패널(실제 후원).
export function FundingDetailPage(p: DetailProps): HTMLElement {
  const v = p.project;
  if (!v) return notFound(p.header);

  const badge = STATUS_BADGE[v.status];
  const isCreator = v.creatorName === p.currentNick;
  const panel: PanelData = {
    target: v.target, raised: v.raised, funderCount: v.funderCount,
    deadline: v.deadline, status: v.status,
    balance: p.balance, cap: CAP, maxParticipatable: maxParticipatable(v.raised, v.target, p.balance), isCreator,
  };
  const funders: FunderRow[] = v.topFunders.map((f) => ({ name: f.nickname, amount: f.amount, sharePct: f.sharePct }));

  return el("div", {},
    Header(p.header),
    el("main", { class: "page" },
      el("a", { class: "backlink", href: "#/", text: "← 둘러보기로" }),
      el("div", { class: "detail" },
        el("div", { class: "detail__main" },
          el("div", { class: "detail__thumb", style: `background:${v.gradient}`, role: "img", "aria-label": `${v.title} 대표 이미지` },
            el("span", { class: `badge ${badge.cls}`, text: badge.label }),
            el("span", { class: "card__cat", text: v.category }),
          ),
          el("h1", { class: "detail__title", text: v.title }),
          el("div", { class: "creator-row" },
            el("span", { class: "creator-row__avatar", "aria-hidden": "true", text: v.creatorName.slice(0, 1) }),
            el("span", { text: `${v.creatorName} · 창작자` }),
          ),
          el("div", { class: "story" },
            el("h2", { text: "프로젝트 소개" }),
            ...v.description.map((para, i) => el("p", { class: i === 0 ? "story__lead" : "", text: para })),
          ),
          FunderList(funders, v.moreFunders),
        ),
        el("aside", { class: "detail__aside" }, FundingPanel(panel, p.now, p.onContribute)),
      ),
    ),
  );
}
