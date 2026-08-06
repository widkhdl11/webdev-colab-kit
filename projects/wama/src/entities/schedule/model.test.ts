import { describe, it, expect } from "vitest";
import {
  subjectWeekdays, groupSlots, timeRangeLabel,
  type ScheduleSlot, type Weekday,
} from "./model";

// 시간표 → "과목별 요일 목록" 파생. 수강료 안내 이미지의 시간표 블록이 이 모양을 쓴다
// (design-rules "학부모 전달용 출력물": 과목=행 · 요일 나열 · 시간 미표기).
// 저장하지 않고 조회 시점에 만든다 — 시간표를 고치면 즉시 따라와야 한다(INV-PN7 과 같은 이유).

const slot = (subject: string, weekday: ScheduleSlot["weekday"]): ScheduleSlot => ({
  id: `${subject}-${weekday}`,
  subject,
  weekday,
  start: "17:00",
  end: "18:30",
  teacher: "김선생",
});

describe("subjectWeekdays", () => {
  it("과목별로 묶고 요일을 월~일 순으로 정렬한다", () => {
    expect(subjectWeekdays([slot("수학", "금"), slot("수학", "월"), slot("수학", "수")])).toEqual([
      { subject: "수학", weekdays: ["월", "수", "금"] },
    ]);
  });

  it("과목 순서는 시간표에 처음 나온 순서를 지킨다", () => {
    const out = subjectWeekdays([slot("논술", "화"), slot("수학", "월")]);
    expect(out.map((r) => r.subject)).toEqual(["논술", "수학"]);
  });

  it("같은 과목이 같은 요일에 두 번 있어도 요일은 한 번만 (오전·오후 반)", () => {
    expect(subjectWeekdays([slot("수학", "월"), slot("수학", "월")])[0]?.weekdays).toEqual(["월"]);
  });

  it("주말도 순서에 포함한다", () => {
    expect(subjectWeekdays([slot("한국사", "일"), slot("한국사", "토")])[0]?.weekdays).toEqual(["토", "일"]);
  });

  it("빈 시간표는 빈 배열", () => {
    expect(subjectWeekdays([])).toEqual([]);
  });
});

// 같은 수업이 요일만 다르면 한 줄로 묶어 보여준다. 이 규칙이 화면마다 다르면
// "편집에선 1줄인데 상세에선 2줄"처럼 같은 데이터가 다르게 보인다(사용자 보고 2026-08-04).
describe("groupSlots", () => {
  const at = (subject: string, weekday: ScheduleSlot["weekday"], start: string, end: string, teacher = "김선생"): ScheduleSlot =>
    ({ id: `${subject}-${weekday}-${start}`, subject, weekday, start, end, teacher });

  it("과목·시간·담당이 같으면 한 묶음, 요일만 모은다", () => {
    const g = groupSlots([at("수학", "월", "17:00", "18:30"), at("수학", "수", "17:00", "18:30")]);
    expect(g).toHaveLength(1);
    expect(g[0]?.days.map((d) => d.weekday)).toEqual(["월", "수"]);
  });

  it("시간이 다르면 다른 묶음 — 월 5시 반과 수 7시 반은 다른 수업이다", () => {
    const g = groupSlots([at("수학", "월", "17:00", "18:30"), at("수학", "수", "19:00", "20:30")]);
    expect(g).toHaveLength(2);
  });

  it("담당 선생님이 다르면 다른 묶음", () => {
    const g = groupSlots([at("수학", "월", "17:00", "18:30", "김"), at("수학", "수", "17:00", "18:30", "박")]);
    expect(g).toHaveLength(2);
  });

  it("요일은 월~일 순으로 정렬한다", () => {
    const g = groupSlots([at("수학", "금", "17:00", "18:30"), at("수학", "월", "17:00", "18:30")]);
    expect(g[0]?.days.map((d) => d.weekday)).toEqual(["월", "금"]);
  });

  it("슬롯 id 를 함께 들고 있다 — 묶음 삭제가 각 슬롯을 지워야 한다", () => {
    const g = groupSlots([at("수학", "월", "17:00", "18:30")]);
    expect(g[0]?.days[0]?.id).toBe("수학-월-17:00");
  });

  it("빈 시간표는 빈 배열", () => {
    expect(groupSlots([])).toEqual([]);
  });
});

// 시간은 선택 입력이다(DECISIONS 2026-08-06). 학원 현장에서 시각은 그 주 사정으로 흔들리고,
// 필수로 두면 기본값(17:00–18:30)이 그대로 저장돼 **틀린 시간이 맞는 것처럼** 표에 박힌다.
describe("시간 미입력 슬롯", () => {
  const noTime = (id: string, subject: string, weekday: Weekday): ScheduleSlot =>
    ({ id, subject, weekday, start: null, end: null, teacher: "김지현" });

  it("시간이 비어도 과목·담당이 같으면 한 묶음이다", () => {
    const g = groupSlots([noTime("1", "수학", "월"), noTime("2", "수학", "수")]);
    expect(g).toHaveLength(1);
    expect(g[0]?.days.map((d) => d.weekday)).toEqual(["월", "수"]);
  });

  it("시간 있는 수업과 없는 수업은 다른 묶음이다", () => {
    const g = groupSlots([
      noTime("1", "수학", "월"),
      { id: "2", subject: "수학", weekday: "수", start: "17:00", end: "18:30", teacher: "김지현" },
    ]);
    expect(g).toHaveLength(2);
  });

  it("수강 과목·요일 파생은 시간과 무관하다 — 수강료는 주 횟수로 계산된다(INV-PN7)", () => {
    const sw = subjectWeekdays([noTime("1", "수학", "월"), noTime("2", "수학", "수")]);
    expect(sw).toEqual([{ subject: "수학", weekdays: ["월", "수"] }]);
  });
});

describe("timeRangeLabel — 두 화면이 같은 문구를 쓰게", () => {
  it("둘 다 있으면 범위로 잇는다", () => {
    expect(timeRangeLabel("17:00", "18:30")).toBe("17:00–18:30");
  });

  it("비어 있으면 대시 하나 — 화면마다 다르게 표시하지 않는다", () => {
    expect(timeRangeLabel(null, null)).toBe("—");
  });

  it("한쪽만 있는 건 저장될 수 없지만(DB CHECK), 들어와도 반쪽으로 그리지 않는다", () => {
    expect(timeRangeLabel("17:00", null)).toBe("—");
    expect(timeRangeLabel(null, "18:30")).toBe("—");
  });
});
