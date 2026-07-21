import { el } from "@/shared/lib/dom";
import { formatPoints, formatRemaining, progressPct } from "@/shared/lib/format";
import type { ProjectView } from "@/entities/funding/store";

export type CardStatus = "OPEN" | "SUCCESS" | "FAILED";

// 상태 → 배지 라벨/클래스. 상세·지갑 화면도 이 단일 맵을 공유한다.
export const STATUS_BADGE: Record<CardStatus, { label: string; cls: string }> = {
  OPEN: { label: "진행 중", cls: "badge--open" },
  SUCCESS: { label: "달성", cls: "badge--success" },
  FAILED: { label: "무산", cls: "badge--failed" },
};

// ProjectView → 카드 표시 데이터 어댑터 (홈·지갑 공용).
export const toCardData = (v: ProjectView): FundingCardData => ({
  id: v.id, title: v.title, creatorName: v.creatorName, category: v.category,
  gradient: v.gradient, target: v.target, raised: v.raised,
  deadline: v.deadline, funderCount: v.funderCount, status: v.status,
});

// 카드가 받는 표시 계약. 도메인 Funding과 별개로 위젯이 필요한 화면 데이터만 정의한다.
export interface FundingCardData {
  id: string;
  title: string;
  creatorName: string;
  category: string;
  gradient: string; // 썸네일 placeholder (콘텐츠성 데이터)
  target: number;
  raised: number;
  deadline: number; // epoch ms
  funderCount: number;
  status: CardStatus;
}

const STATE_NOTE: Record<CardStatus, (deadline: number, now: number) => string> = {
  OPEN: (d, now) => formatRemaining(d, now),
  SUCCESS: () => "목표 달성 · 정산 완료",
  FAILED: () => "기한 내 미달성",
};

// 펀딩 카드 — 썸네일 · 제목 · 진행률 · 금액 · 메타. 표시만 담당.
export function FundingCard(d: FundingCardData, now: number): HTMLElement {
  const pct = progressPct(d.raised, d.target);
  const badge = STATUS_BADGE[d.status];
  const lower = d.status.toLowerCase();

  return el("a", { class: "card-link", href: `#/f/${d.id}`, "aria-label": `${d.title} 상세 보기` },
   el("article", { class: "card" },
    el("div", {
      class: "card__thumb",
      style: `background:${d.gradient}`,
      role: "img",
      "aria-label": `${d.title} 대표 이미지`,
    },
      el("span", { class: `badge ${badge.cls}`, text: badge.label }),
      el("span", { class: "card__cat", text: d.category }),
    ),
    el("div", { class: "card__body" },
      el("h3", { class: "card__title", text: d.title }),
      el("p", { class: "card__creator", text: `by ${d.creatorName}` }),
      el("div", { class: "progress", role: "progressbar",
        "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100,
        "aria-label": `달성률 ${pct}%` },
        el("div", { class: `progress__bar progress__bar--${lower}`, style: `width:${pct}%` }),
      ),
      el("div", { class: "card__stats" },
        el("span", { class: `card__pct card__pct--${lower}`, text: `${pct}%` }),
        el("span", { class: "card__amount", text: `${formatPoints(d.raised)} / ${formatPoints(d.target)}` }),
      ),
      el("div", { class: "card__meta" },
        el("span", { text: STATE_NOTE[d.status](d.deadline, now) }),
        el("span", { text: `후원 ${d.funderCount.toLocaleString("ko-KR")}명` }),
      ),
    ),
   ),
  );
}
