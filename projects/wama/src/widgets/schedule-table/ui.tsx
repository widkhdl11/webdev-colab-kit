import type { ReactNode } from "react";
import { groupSlots, timeRangeLabel, type ScheduleSlot } from "@/entities/schedule/model";

// 학생 시간표 표. 표시만 — 묶는 규칙은 entities(groupSlots)가 정한다.
// 같은 수업이 요일만 다르면 한 줄 + 요일 칩으로 보여준다. 슬롯당 한 줄로 두면
// 수학을 월·수로 넣었을 때 상세 화면에만 2줄이 떠서 중복처럼 읽힌다(사용자 보고 2026-08-04).
export function ScheduleTable({ slots }: { readonly slots: ScheduleSlot[] }): ReactNode {
  if (slots.length === 0) {
    return <p className="empty-note">등록된 시간표가 없습니다.</p>;
  }
  return (
    <table className="table">
      <caption className="sr-only">학생 시간표. 과목, 요일, 시간대, 담당 선생님.</caption>
      <thead>
        <tr>
          <th scope="col">과목</th>
          <th scope="col">요일</th>
          <th scope="col">시간</th>
          <th scope="col">담당</th>
        </tr>
      </thead>
      <tbody>
        {groupSlots(slots).map((g) => (
          <tr key={`${g.subject}-${g.start}-${g.end}-${g.teacher}`}>
            <td>{g.subject}</td>
            <td>
              <div className="day-cell">
                {g.days.map((d) => <span key={d.weekday} className="day-chip">{d.weekday}</span>)}
              </div>
            </td>
            <td className="num">{timeRangeLabel(g.start, g.end)}</td>
            <td>{g.teacher}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
