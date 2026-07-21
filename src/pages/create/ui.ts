import { el } from "@/shared/lib/dom";
import { Header, type HeaderProps } from "@/widgets/header/ui";
import { formatPoints } from "@/shared/lib/format";
import { parseDigits } from "@/shared/lib/parse";
import { CATEGORIES } from "@/entities/funding/catalog";
import { validateFundingDraft } from "@/entities/funding/rules";
import type { DraftValues } from "@/entities/funding/store";

export interface CreateProps {
  header: HeaderProps;
  balance: number;
  onCreate: (values: DraftValues) => Promise<string | null>; // 실패 시 에러 메시지
}

// 펀딩 개설 폼 — 검증 후 onCreate로 실제 생성을 위임한다.
export function CreatePage(p: CreateProps): HTMLElement {
  const title = el("input", { class: "input input--boxed", id: "c-title", type: "text", placeholder: "예: 손목 위 미니 화분 키트" });
  const desc = el("textarea", { class: "textarea", id: "c-desc", rows: 5, placeholder: "어떤 프로젝트인지, 후원금을 어디에 쓰는지 알려주세요. (줄바꿈으로 문단 구분)" });
  const category = el("select", { class: "input input--boxed", id: "c-cat" },
    ...CATEGORIES.map((c) => el("option", { value: c, text: c })));
  const target = el("input", { class: "input input--boxed", id: "c-target", type: "text", inputmode: "numeric", placeholder: "30,000" });
  const reward = el("input", { class: "input input--boxed", id: "c-reward", type: "text", inputmode: "numeric", placeholder: "1,000" });
  const deadline = el("input", { class: "input input--boxed", id: "c-deadline", type: "date" });

  const message = el("p", { class: "form__message", role: "status" });
  const submit = el("button", { class: "btn btn--primary", type: "button", text: "펀딩 개설하기" });

  submit.addEventListener("click", () => {
    const t = title.value.trim();
    const tg = parseDigits(target.value);
    const rw = parseDigits(reward.value);
    const errors = validateFundingDraft({ title: t, target: tg, rewardPool: rw, balance: p.balance, hasDeadline: Boolean(deadline.value) });
    if (errors.length > 0) {
      message.className = "form__message form__message--error";
      message.textContent = errors.join(" · ");
      return;
    }
    // 마감일 = 선택한 날짜의 그날 끝(로컬)
    const dl = new Date(`${deadline.value}T23:59:59`).getTime();
    const paragraphs = desc.value.split("\n").map((s) => s.trim()).filter(Boolean);
    submit.disabled = true;
    message.className = "form__message";
    message.textContent = "등록 중…";
    void p.onCreate({
      title: t, description: paragraphs.length > 0 ? paragraphs : ["(소개가 아직 없어요)"],
      category: category.value, target: tg, rewardPool: rw, deadline: dl,
    }).then((err) => {
      if (err) {
        submit.disabled = false;
        message.className = "form__message form__message--error";
        message.textContent = err;
      }
      // 성공 시 앱이 상세로 이동시키므로 여기서 추가 처리는 없다.
    });
  });

  const field = (labelText: string, control: HTMLElement, helper?: string, id?: string) =>
    el("div", { class: "field" },
      el("label", { class: "label", for: id, text: labelText }),
      control,
      helper ? el("p", { class: "helper", text: helper }) : null,
    );

  return el("div", {},
    Header(p.header),
    el("main", { class: "page page--narrow" },
      el("a", { class: "backlink", href: "#/", text: "← 둘러보기로" }),
      el("h1", { class: "page-title", text: "펀딩 만들기" }),
      el("p", { class: "page-sub", text: "포인트로 참여받을 프로젝트를 등록해요. 보상 재원은 창작자가 미리 예치합니다." }),
      el("div", { class: "form" },
        field("제목", title, undefined, "c-title"),
        field("소개", desc, undefined, "c-desc"),
        el("div", { class: "form__row" },
          field("카테고리", category, undefined, "c-cat"),
          field("마감일", deadline, undefined, "c-deadline"),
        ),
        el("div", { class: "form__row" },
          field("목표 포인트", target, "100% 모이면 종료·정산돼요", "c-target"),
          field("보상풀(예치)", reward, `달성 시 지분대로 분배 · 내 잔액 ${formatPoints(p.balance)}`, "c-reward"),
        ),
        submit,
        message,
      ),
    ),
  );
}
