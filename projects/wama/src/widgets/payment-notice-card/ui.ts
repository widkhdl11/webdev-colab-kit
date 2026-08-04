import { el } from "@/shared/lib/dom";
import { formatWon } from "@/shared/lib/money";
import type { SubjectWeekdays } from "@/entities/schedule/model";
import type { NoticeStudent } from "@/entities/tuition/model";
import "./card.css";

// 학부모 전달용 수강료 안내 카드. **이 DOM 이 그대로 PNG 로 캡처된다.**
// 시각 기준: design-rules.md "학부모 전달용 출력물" / 시안: mockups/payment-notice.html
// 표시만 한다 — 금액 계산·검증은 entities(tuition·academy)에서 이미 끝난 값이 들어온다.
//
// INV-PN3: 이 props 에 없는 값은 이미지에 나갈 수 없다. 평가·생년월일 전체·연락처·주소는 자리 자체가 없다.
// INV-PN4: 학생 이름과 대상 월은 필수 — 비면 호출부가 생성을 막는다(noticeBlockers).
export interface PaymentNoticeCardProps {
  readonly academyName: string;
  readonly branch: string | null;
  readonly phone: string | null;
  readonly targetMonth: string; // "2026.08"
  readonly student: NoticeStudent;
  readonly timetable: readonly SubjectWeekdays[];
  readonly totalFee: number;
  readonly noticeText: string; // 자리표시자는 이미 치환된 상태
  readonly extraNote: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
}

// "2026.08" → "2026년 8월" (앞자리 0 제거 — 사람이 읽는 문서다)
function monthLabel(targetMonth: string): string {
  const [year, month] = targetMonth.split(".");
  return year && month ? `${year}년 ${Number(month)}월` : targetMonth;
}

function studentMeta(s: NoticeStudent): string {
  // 생년은 연도만(INV-PN3). 빈 값은 표시하지 않는다 — "· ·" 같은 빈 구분자가 남지 않게.
  return [s.grade, s.school, s.birthYear ? `${s.birthYear}년생` : ""].filter(Boolean).join(" · ");
}

export function renderPaymentNoticeCard(p: PaymentNoticeCardProps): HTMLElement {
  const timetableBlock = p.timetable.length === 0
    ? el("p", { class: "pnc__note" }, "등록된 시간표가 없습니다.")
    : el("table", { class: "pnc__table" },
        el("thead", {},
          el("tr", {},
            el("th", { scope: "col" }, "과목"),
            el("th", { scope: "col" }, "요일"),
          ),
        ),
        el("tbody", {},
          ...p.timetable.map((row) =>
            el("tr", {},
              el("th", { scope: "row" }, row.subject),
              el("td", {}, row.weekdays.join(" · ")),
            ),
          ),
        ),
      );

  return el("div", { class: "pnc" },
    el("div", { class: "pnc__head" },
      el("div", { class: "pnc__brand" },
        el("span", { class: "pnc__logo", "aria-hidden": "true" }, p.academyName.slice(0, 1)),
        el("div", {},
          el("div", { class: "pnc__academy" }, p.academyName),
          p.branch ? el("div", { class: "pnc__branch" }, p.branch) : el("span", { hidden: "" }),
        ),
      ),
      el("div", {},
        el("div", { class: "pnc__month-label" }, "수강료 안내"),
        el("div", { class: "pnc__month" }, monthLabel(p.targetMonth)),
      ),
    ),

    el("div", { class: "pnc__block pnc__block--soft" },
      el("span", { class: "pnc__label" }, "학생"),
      el("div", { class: "pnc__student-name" }, p.student.name),
      el("div", { class: "pnc__student-meta" }, studentMeta(p.student)),
    ),

    el("p", { class: "pnc__greeting" }, p.noticeText),

    el("div", { class: "pnc__block pnc__block--line" },
      el("span", { class: "pnc__label" }, "수업 시간표"),
      timetableBlock,
    ),

    el("div", { class: "pnc__amount" },
      el("span", { class: "pnc__amount-label" }, `${monthLabel(p.targetMonth)} 수강료`),
      el("span", { class: "pnc__amount-value" }, formatWon(p.totalFee)),
    ),

    el("div", { class: "pnc__block pnc__block--soft" },
      el("span", { class: "pnc__label" }, "입금 계좌"),
      el("div", { class: "pnc__pay" },
        el("span", { class: "pnc__pay-bank" }, p.bankName),
        el("span", { class: "pnc__pay-sep", "aria-hidden": "true" }),
        el("span", { class: "pnc__pay-account" }, p.accountNumber),
        el("span", { class: "pnc__pay-sep", "aria-hidden": "true" }),
        el("span", { class: "pnc__pay-holder-label" }, "예금주"),
        el("span", { class: "pnc__pay-holder" }, p.accountHolder),
      ),
    ),

    p.extraNote.trim()
      ? el("div", { class: "pnc__block pnc__block--wait" },
          el("span", { class: "pnc__label" }, "안내"),
          el("span", { class: "pnc__note" }, p.extraNote),
        )
      : el("span", { hidden: "" }),

    el("div", { class: "pnc__spacer" }),
    el("div", { class: "pnc__foot" },
      [p.academyName, p.branch, p.phone].filter(Boolean).join(" · ")),
  );
}
