// 학생 시간표 표시용 읽기 모델. 과목·요일·시간대 — 학생마다 상이.
export type Weekday = "월" | "화" | "수" | "목" | "금" | "토" | "일";

// 시간은 **선택 입력**이다(DECISIONS 2026-08-06). null = 아직 안 정함.
// 필수로 두면 선생님이 기본값(17:00–18:30)을 그대로 저장하게 되고, 틀린 시간이 맞는 것처럼 표에 박힌다.
// 둘 중 하나만 채우는 상태는 DB CHECK(schedule_time_pair)가 막는다 — 반쪽 표시를 만들지 않기 위해.
export interface ScheduleSlot {
  readonly id: string;
  readonly subject: string;
  readonly weekday: Weekday;
  readonly start: string | null; // "17:00" | null
  readonly end: string | null; // "18:30" | null
  readonly teacher: string;
}

// 시간 표시 문구. 두 화면(시간표 편집·학생 상세)이 같은 문구를 쓰도록 여기 한 벌만 둔다 —
// 화면마다 빈 시간을 다르게 그리면 같은 데이터가 다르게 보인다.
export function timeRangeLabel(start: string | null, end: string | null): string {
  return start && end ? `${start}–${end}` : "—";
}

// 요일 정렬의 단일 기준. 문자열 정렬로는 월·화·수 순서가 나오지 않는다.
export const WEEKDAY_ORDER: readonly Weekday[] = ["월", "화", "수", "목", "금", "토", "일"];

export interface ScheduleGroup {
  readonly subject: string;
  readonly start: string | null;
  readonly end: string | null;
  readonly teacher: string;
  readonly days: readonly { weekday: Weekday; id: string }[];
}

// 같은 수업(과목·시간·담당이 같음)이 요일만 다르면 한 묶음으로 본다.
// 이 규칙이 화면마다 다르면 같은 데이터가 다르게 보인다 — 편집 화면은 1줄인데
// 상세 화면은 2줄로 나와 "중복인가?" 로 읽혔다(사용자 보고 2026-08-04). 그래서 여기 한 벌만 둔다.
// 시간·담당이 다르면 실제로 다른 수업이므로 묶지 않는다.
export function groupSlots(slots: readonly ScheduleSlot[]): ScheduleGroup[] {
  // 시간이 비면 키에 "" 가 들어가 빈 시간끼리 묶인다 — 의도한 동작이다(같은 과목·담당의 미정 수업은 한 줄).
  const map = new Map<string, {
    subject: string; start: string | null; end: string | null;
    teacher: string; days: { weekday: Weekday; id: string }[];
  }>();
  for (const s of slots) {
    const key = `${s.subject}|${s.start}|${s.end}|${s.teacher}`;
    const g = map.get(key) ?? { subject: s.subject, start: s.start, end: s.end, teacher: s.teacher, days: [] };
    g.days.push({ weekday: s.weekday, id: s.id });
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.days.sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday));
  }
  return [...map.values()];
}

export interface SubjectWeekdays {
  readonly subject: string;
  readonly weekdays: readonly Weekday[];
}

// 시간표 → 과목별 요일 목록. 수강료 안내 이미지의 시간표 블록이 쓰는 모양
// (design-rules "학부모 전달용 출력물": 과목=행 · 요일 나열 · 시간 미표기).
// 저장하지 않고 조회 시점에 만든다 — 시간표를 고치면 즉시 따라와야 한다.
// 과목 순서는 시간표에 처음 나온 순서를 지킨다(사용자가 넣은 순서가 곧 그 학원의 우선순위다).
export function subjectWeekdays(slots: readonly ScheduleSlot[]): SubjectWeekdays[] {
  const bySubject = new Map<string, Set<Weekday>>();
  for (const s of slots) {
    const days = bySubject.get(s.subject) ?? new Set<Weekday>();
    days.add(s.weekday);
    bySubject.set(s.subject, days);
  }
  return [...bySubject].map(([subject, days]) => ({
    subject,
    weekdays: WEEKDAY_ORDER.filter((d) => days.has(d)),
  }));
}
