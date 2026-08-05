import type { ReactNode, Ref } from "react";
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
  /** 캡처 대상 노드를 호출부(page)가 잡는다 — html2canvas 가 이 노드를 그린다. */
  readonly ref?: Ref<HTMLDivElement>;
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

export function PaymentNoticeCard(p: PaymentNoticeCardProps): ReactNode {
  const month = monthLabel(p.targetMonth);
  return (
    <div className="pnc" ref={p.ref}>
      <div className="pnc__head">
        <div className="pnc__brand">
          <span className="pnc__logo" aria-hidden="true">{p.academyName.slice(0, 1)}</span>
          <div>
            <div className="pnc__academy">{p.academyName}</div>
            {p.branch && <div className="pnc__branch">{p.branch}</div>}
          </div>
        </div>
        <div>
          <div className="pnc__month-label">수강료 안내</div>
          <div className="pnc__month">{month}</div>
        </div>
      </div>

      <div className="pnc__block pnc__block--soft">
        <span className="pnc__label">학생</span>
        <div className="pnc__student-name">{p.student.name}</div>
        <div className="pnc__student-meta">{studentMeta(p.student)}</div>
      </div>

      <p className="pnc__greeting">{p.noticeText}</p>

      <div className="pnc__block pnc__block--line">
        <span className="pnc__label">수업 시간표</span>
        {p.timetable.length === 0
          ? <p className="pnc__note">등록된 시간표가 없습니다.</p>
          : (
            <table className="pnc__table">
              <thead>
                <tr>
                  <th scope="col">과목</th>
                  <th scope="col">요일</th>
                </tr>
              </thead>
              <tbody>
                {p.timetable.map((row) => (
                  <tr key={row.subject}>
                    <th scope="row">{row.subject}</th>
                    <td>{row.weekdays.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <div className="pnc__amount">
        <span className="pnc__amount-label">{`${month} 수강료`}</span>
        <span className="pnc__amount-value">{formatWon(p.totalFee)}</span>
      </div>

      <div className="pnc__block pnc__block--soft">
        <span className="pnc__label">입금 계좌</span>
        <div className="pnc__pay">
          <span className="pnc__pay-bank">{p.bankName}</span>
          <span className="pnc__pay-sep" aria-hidden="true" />
          <span className="pnc__pay-account">{p.accountNumber}</span>
          <span className="pnc__pay-sep" aria-hidden="true" />
          <span className="pnc__pay-holder-label">예금주</span>
          <span className="pnc__pay-holder">{p.accountHolder}</span>
        </div>
      </div>

      {p.extraNote.trim() && (
        <div className="pnc__block pnc__block--wait">
          <span className="pnc__label">안내</span>
          <span className="pnc__note">{p.extraNote}</span>
        </div>
      )}

      <div className="pnc__spacer" />
      <div className="pnc__foot">{[p.academyName, p.branch, p.phone].filter(Boolean).join(" · ")}</div>
    </div>
  );
}
