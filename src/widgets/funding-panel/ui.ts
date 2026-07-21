import { el } from "@/shared/lib/dom";
import { formatPoints, formatRemaining, progressPct } from "@/shared/lib/format";
import { parseDigits } from "@/shared/lib/parse";
import { expectedSharePct } from "@/entities/funding/rules";

export type PanelStatus = "OPEN" | "SUCCESS" | "FAILED";

// 후원 패널 표시 계약. 참여 가능 최대치(maxParticipatable)는 상위(entities)에서 계산해 넘긴다.
export interface PanelData {
  target: number;
  raised: number;
  funderCount: number;
  deadline: number;
  status: PanelStatus;
  balance: number;
  cap: number;
  maxParticipatable: number;
  isCreator: boolean; // 자기 펀딩엔 참여 불가
}

// 진행 현황 + 후원 폼. 입력에 따라 예상 지분·버튼이 실시간 갱신되고, 제출 시 onContribute로 실제 차감을 위임한다.
export function FundingPanel(d: PanelData, now: number, onContribute?: (amount: number) => void): HTMLElement {
  const pct = progressPct(d.raised, d.target);
  const lower = d.status.toLowerCase();
  const remaining =
    d.status === "OPEN" ? formatRemaining(d.deadline, now) : d.status === "SUCCESS" ? "정산 완료" : "마감";

  const panel = el("div", { class: "panel" },
    el("div", {},
      el("div", { class: `panel__pct panel__pct--${lower}`, text: `${pct}%` }),
      el("div", { class: "panel__raised", text: `${formatPoints(d.raised)} / ${formatPoints(d.target)} 모임` }),
    ),
    el("div", {
      class: "progress", role: "progressbar",
      "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `달성률 ${pct}%`,
    },
      el("div", { class: `progress__bar progress__bar--${lower}`, style: `width:${pct}%` }),
    ),
    el("div", { class: "panel__meta" },
      el("span", { text: `후원 ${d.funderCount.toLocaleString("ko-KR")}명` }),
      el("span", { text: remaining }),
    ),
  );

  if (d.status !== "OPEN") {
    panel.append(
      el("div", { class: "panel__divider" }),
      el("p", { class: "panel__note",
        text: d.status === "SUCCESS"
          ? "목표를 달성해 정산이 완료된 펀딩이에요."
          : "기한 내 목표에 도달하지 못해 종료된 펀딩이에요." }),
    );
    return panel;
  }

  if (d.isCreator) {
    panel.append(
      el("div", { class: "panel__divider" }),
      el("p", { class: "panel__note", text: "내가 만든 펀딩에는 참여할 수 없어요. 다른 프로젝트를 둘러보세요." }),
    );
    return panel;
  }

  // --- 참여 폼 (실시간 피드백 + 실제 후원 위임) ---
  const canParticipate = d.maxParticipatable > 0;
  const shareValue = el("strong", { text: "약 0%" });
  const errorLine = el("p", { class: "panel__error", role: "status" });
  const submit = el("button", {
    class: "btn btn--primary btn--block", type: "button", disabled: true,
    text: canParticipate ? "금액을 입력하세요" : "지금은 참여할 수 없어요",
  });
  const input = el("input", {
    class: "input", id: "fund-amount", type: "text", inputmode: "numeric",
    placeholder: "0", disabled: !canParticipate, "aria-describedby": "fund-help",
  });

  const recompute = () => {
    const n = parseDigits(input.value);
    shareValue.textContent = `약 ${expectedSharePct(d.raised, n)}%`;
    if (n <= 0) {
      submit.disabled = true; submit.textContent = "금액을 입력하세요"; errorLine.textContent = "";
    } else if (n > d.maxParticipatable) {
      submit.disabled = true; submit.textContent = `${formatPoints(n)} 후원하기`;
      errorLine.textContent = `지금은 최대 ${formatPoints(d.maxParticipatable)}까지 참여할 수 있어요.`;
    } else {
      submit.disabled = false; submit.textContent = `${formatPoints(n)} 후원하기`; errorLine.textContent = "";
    }
  };
  input.addEventListener("input", recompute);
  submit.addEventListener("click", () => {
    const n = parseDigits(input.value);
    if (n <= 0 || n > d.maxParticipatable) return;
    submit.disabled = true; // 재렌더가 새 패널을 그린다
    onContribute?.(n);
  });

  const helpText = canParticipate
    ? `1회 최대 ${formatPoints(d.cap)} · 내 잔액 ${formatPoints(d.balance)} (지금 최대 ${formatPoints(d.maxParticipatable)})`
    : `참여 가능한 잔액이 없거나 목표가 가득 찼어요 · 내 잔액 ${formatPoints(d.balance)}`;

  panel.append(
    el("div", { class: "panel__divider" }),
    el("div", { class: "field" },
      el("label", { class: "label", for: "fund-amount", text: "후원 포인트" }),
      el("div", { class: "input-wrap" }, input, el("span", { class: "input-wrap__suffix", text: "P" })),
      el("p", { class: "helper", id: "fund-help", text: helpText }),
    ),
    el("div", { class: "share-hint" }, el("span", { text: "예상 지분" }), shareValue),
    submit,
    errorLine,
    el("p", { class: "panel__note",
      text: "100% 달성 시 지분만큼 보상 포인트를 받아요. 기한 내 미달성 시 참여 포인트는 소각됩니다." }),
  );
  return panel;
}
