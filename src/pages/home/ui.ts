import { el } from "@/shared/lib/dom";
import { Header, type HeaderProps } from "@/widgets/header/ui";
import { FundingCard, toCardData } from "@/widgets/funding-card/ui";
import type { ProjectView } from "@/entities/funding/store";

// 홈(펀딩 목록) — 진행 중 / 종료된 펀딩 두 섹션.
export function HomePage(header: HeaderProps, projects: ProjectView[], now: number): HTMLElement {
  const open = projects.filter((p) => p.status === "OPEN");
  const closed = projects.filter((p) => p.status !== "OPEN");
  const grid = (items: ProjectView[]) =>
    el("div", { class: "grid" }, ...items.map((p) => FundingCard(toCardData(p), now)));

  return el("div", {},
    Header(header),
    el("main", { class: "page" },
      el("section", { class: "hero" },
        el("h1", { class: "hero__title", text: "포인트로 함께 만드는 펀딩" }),
        el("p", { class: "hero__sub", text: "마음이 가는 프로젝트에 포인트를 모으고, 100% 달성되면 지분만큼 보상을 받아요." }),
      ),
      el("section", { "aria-label": "진행 중인 펀딩" },
        el("h2", { class: "section-title" }, "진행 중",
          el("span", { class: "section-title__count", text: `${open.length}개` })),
        open.length > 0
          ? grid(open)
          : el("p", { class: "empty__mini", text: "지금 진행 중인 펀딩이 없어요. 새 펀딩을 만들어보세요." }),
      ),
      closed.length > 0
        ? el("section", { class: "section--gap", "aria-label": "종료된 펀딩" },
            el("h2", { class: "section-title" }, "종료된 펀딩",
              el("span", { class: "section-title__count", text: `${closed.length}개` })),
            grid(closed),
          )
        : null,
    ),
  );
}
